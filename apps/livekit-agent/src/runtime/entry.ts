import {
  type JobContext,
  llm,
  metrics,
  runWithJobContextAsync,
  voice,
} from "@livekit/agents";
import { Room, RoomEvent, RemoteParticipant } from "@livekit/rtc-node";
import * as silero from "@livekit/agents-plugin-silero";
import * as livekit from "@livekit/agents-plugin-livekit";
import { RoomServiceClient } from "livekit-server-sdk";
import {
  loadInterviewContext,
  loadUserContext,
  buildSystemPrompt,
} from "../services/context-loader";
import { BASE_SYSTEM_PROMPT } from "../constants/prompts";
import {
  TECH_VOCABULARY,
  CHINESE_CONTEXT_VOCABULARY,
} from "../constants/vocabulary";
import type { InterviewContext } from "./types";
import { publishDataToRoom } from "./livekit";
import { createInterviewApplier } from "./interview";
import { createUserTextResponder } from "./responders";
import { TurnCoordinator } from "./turn-coordinator";
import {
  createDeepgramSTT,
  createConfiguredLLM,
  createConfiguredTTS,
} from "../config/providers";
import {
  saveUserMessage,
  saveAiMessage,
} from "../services/message-persistence";
import { extractKeywordsFromProfile } from "../services/keyword-extractor";
import { sendKickoffWithRetry } from "./kickoff";

type TurnMode = "manual" | "vad";

/**
 * Kick all existing agents from a room before connecting.
 * This prevents duplicate agents during hot-reloads.
 */
async function kickOldAgents(roomName: string): Promise<void> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    console.warn("[kickOldAgents] Missing LiveKit credentials, skipping");
    return;
  }

  // Convert ws:// to http:// for API calls
  const httpUrl = wsUrl.replace(/^ws(s)?:\/\//, "http$1://");

  try {
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const participants = await roomService.listParticipants(roomName);

    const oldAgents = participants.filter((p) =>
      p.identity.startsWith("agent-"),
    );

    if (oldAgents.length > 0) {
      for (const agent of oldAgents) {
        try {
          await roomService.removeParticipant(roomName, agent.identity);
        } catch (e) {
          console.warn(`[kickOldAgents] Failed to kick ${agent.identity}:`, e);
        }
      }
    }
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    // Room might not exist yet, which is fine
    console.log(
      `[kickOldAgents] Could not check room "${roomName}":`,
      errorMessage,
    );
  }
}

/**
 * Agent 运行入口
 * @param ctx
 */
export async function agentEntry(ctx: JobContext) {
  // 关闭先前的会话房间
  const roomName = ctx.job?.room?.name || ctx.room.name;

  if (roomName) await kickOldAgents(roomName);
  // Agent连入房间
  await ctx.connect();
  // 等待第一个用户连入房间
  const participant = await ctx.waitForParticipant();
  const vad = ctx.proc.userData.vad as silero.VAD;

  await runWithJobContextAsync(ctx, async () => {
    await runAgentSession(ctx.room, participant, vad);
  });
}

export async function runAgentSession(
  room: Room,
  participant: RemoteParticipant,
  vad: silero.VAD,
) {
  let userProfile: unknown = null;
  if (!participant.identity.startsWith("agent-")) {
    userProfile = await loadUserContext(participant.identity);
  }

  const currentPrompt = buildSystemPrompt(
    userProfile,
    BASE_SYSTEM_PROMPT,
    null,
  );
  // 从参与者元数据中获取语言设置 (locale)
  let locale = "zh";
  try {
    if (participant.metadata) {
      const metadata = JSON.parse(participant.metadata);
      if (metadata.locale) {
        locale = metadata.locale;
        console.log(`[Agent Session] Detected user locale: ${locale}`);
      }
    }
  } catch (e) {
    console.warn("[Agent Session] Failed to parse participant metadata", e);
  }

  // 从用户资料中提取关键词（姓名、学校、公司等专有名词）
  const profileKeywords = extractKeywordsFromProfile(userProfile as any);

  // 合并词汇表：通用技术词汇 + 中文专用词汇（如果是中文） + 用户特定关键词
  const combinedVocabulary = [
    ...TECH_VOCABULARY,
    ...(locale === "zh" ? CHINESE_CONTEXT_VOCABULARY : []),
    ...profileKeywords,
  ];

  console.log(
    `[STT Init] Profile-specific keywords (${profileKeywords.length}):`,
    profileKeywords,
  );

  // 定义Agent如何处理音频输入和输出
  const session = new voice.AgentSession({
    stt: createDeepgramSTT(combinedVocabulary, locale),
    llm: await createConfiguredLLM(participant.identity),
    tts: createConfiguredTTS(locale),
    vad: vad,
    // 使用 Turn Detector 多语言模型，基于语义理解判断用户是否说完
    // 可以理解"让我想想..."这类语句，不会在用户思考时打断
    turnDetection: new livekit.turnDetector.MultilingualModel(),
    voiceOptions: {
      allowInterruptions: false,
      minInterruptionDuration: 500,
      minInterruptionWords: 0,
      minEndpointingDelay: 1000,
      // 面试场景：允许候选人最长 25 秒的思考时间
      maxEndpointingDelay: 25000,
    },
  });
  const turnCoordinator = new TurnCoordinator(session);

  class InterviewAgent extends voice.Agent {
    async onUserTurnCompleted(
      _chatCtx: llm.ChatContext,
      newMessage: llm.ChatMessage,
    ) {
      if (turnMode === "manual") {
        const messageId = (newMessage as { id?: string })?.id;
        if (messageId) {
          session.history.items = session.history.items.filter(
            (item) => item.id !== messageId,
          );
        }
        throw new voice.StopResponse();
      }

      const text = newMessage?.textContent?.trim();
      if (text) {
        turnCoordinator.handleUserTurnEnd(text);
      }
      throw new voice.StopResponse();
    }
  }

  const agent = new InterviewAgent({
    instructions: currentPrompt,
    tools: {},
  });

  // Metrics / errors
  const usageCollector = new metrics.UsageCollector();
  session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
    metrics.logMetrics(ev.metrics);
    usageCollector.collect(ev.metrics);
  });
  session.on(voice.AgentSessionEventTypes.Error, (ev) => {
    console.error("[Agent Error]", ev.error);
  });

  session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (ev) => {
    if (turnMode === "manual") return;
    if (ev.transcript?.trim()) {
      turnCoordinator.markVoiceActivity();
    }
  });

  // 使用 ConversationItemAdded 事件处理用户和 Agent 的消息
  // 结合 TurnCoordinator 进行用户轮次合并，避免短暂停顿导致多次回复
  session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
    const item = ev.item;
    if (item.type !== "message") return;
    const text = item.textContent?.trim();
    if (!text) return;

    if (item.role === "user") {
      if (turnMode === "manual") {
        return;
      }
      // 过滤掉以"系统："开头的内部指令，不发送到前端
      if (text.startsWith("系统：") || text.startsWith("系统:")) {
        return;
      }
      if (!turnCoordinator.shouldPublishUserMessage(item)) {
        return;
      }
      // 用户轮次结束，发送完整的用户消息
      console.log(`[User Transcript] ${text}`);
      publishDataToRoom(room, {
        type: "transcript",
        role: "user",
        text,
        isFinal: true,
        timestamp: Date.now(),
      });

      // 保存用户消息到数据库
      if (latestInterview && typeof latestInterview.id === "string") {
        saveUserMessage(latestInterview.id, text);
      }
    } else if (item.role === "assistant") {
      // Agent 回复
      publishDataToRoom(room, {
        type: "agent_speech",
        text,
        timestamp: Date.now(),
      });

      // 保存 Agent 消息到数据库
      if (latestInterview && typeof latestInterview.id === "string") {
        saveAiMessage(latestInterview.id, text);
      }
    }
  });

  // state for rpc/order
  let sessionRunning = false;
  let pendingInterview: InterviewContext | null = null;
  const pendingUserTexts: string[] = [];
  let startInterviewHandled = false;
  let latestInterview: InterviewContext | null = null;
  let applyInterviewScheduled = false;
  let hasGreeted = false; // 防止双重开场白的状态锁
  let resolveStartInterview: ((v: InterviewContext) => void) | null = null;
  const startInterviewPromise = new Promise<InterviewContext>((resolve) => {
    resolveStartInterview = resolve;
  });

  const applyInterview = createInterviewApplier({
    session,
    userId: participant.identity,
    userProfile,
    onToolEvent: (payload) => publishDataToRoom(room, payload),
    hasGreeted: () => hasGreeted,
    setGreeted: () => {
      hasGreeted = true;
    },
  });
  const respondToUserText = createUserTextResponder({ session });
  let turnMode: TurnMode = "manual";
  const pendingManualTextQueue: string[] = [];
  let isProcessingManualQueue = false;

  const processManualTextQueue = async () => {
    if (isProcessingManualQueue) return;
    if (turnMode !== "manual") return;
    if (!sessionRunning) return;

    isProcessingManualQueue = true;
    try {
      while (pendingManualTextQueue.length > 0) {
        const nextText = pendingManualTextQueue.shift();
        if (!nextText) continue;
        await respondToUserText(nextText);
      }
    } finally {
      isProcessingManualQueue = false;
    }
  };

  const scheduleApplyLatestInterview = () => {
    if (!sessionRunning) return;
    if (!latestInterview) return;
    if (applyInterviewScheduled) return;
    applyInterviewScheduled = true;
    setTimeout(async () => {
      applyInterviewScheduled = false;
      if (!sessionRunning || !latestInterview) return;
      startInterviewHandled = true;
      await applyInterview(latestInterview);
    }, 0);
  };

  const getStartInterviewPayload = (
    m: Record<string, unknown>,
  ): { interviewId: string; turnMode: TurnMode } | null => {
    if (m.name !== "start_interview") return null;
    const data = m.data;
    if (!data || typeof data !== "object") return null;
    const d = data as Record<string, unknown>;
    const interviewId = d.interviewId;
    const modeRaw = d.turnMode;
    const nextTurnMode: TurnMode = modeRaw === "vad" ? "vad" : "manual";

    if (typeof interviewId !== "string" || !interviewId) return null;
    return { interviewId, turnMode: nextTurnMode };
  };

  room.on(RoomEvent.DataReceived, async (payload) => {
    try {
      const msg = JSON.parse(new TextDecoder().decode(payload)) as Record<
        string,
        unknown
      >;

      const startPayload = getStartInterviewPayload(msg);
      if (startPayload) {
        turnMode = startPayload.turnMode;
        const interview = (await loadInterviewContext(
          startPayload.interviewId,
        )) as InterviewContext | null;
        if (interview) {
          latestInterview = interview;
          if (!sessionRunning) pendingInterview = interview;
          resolveStartInterview?.(interview);
          resolveStartInterview = null;
          scheduleApplyLatestInterview();
          return;
        }

        // interview 记录不存在或无权限时，立即走通用开场白兜底
        console.warn(
          `[RPC] Interview context not found for ${startPayload.interviewId}, fallback to generic kickoff`,
        );
        if (!hasGreeted) {
          hasGreeted = true;
          startInterviewHandled = true;
          await sendKickoffWithRetry({
            session,
            userProfile,
          });
        }
        return;
      }

      if (msg.type === "user_text" && typeof msg.text === "string") {
        turnCoordinator.markManualTextInput();
        if (!sessionRunning) {
          pendingUserTexts.push(msg.text);
          return;
        }
        if (turnMode === "manual") {
          pendingManualTextQueue.push(msg.text);
          await processManualTextQueue();
        } else {
          await respondToUserText(msg.text);
        }
      }
    } catch (e) {
      console.error("[RPC] Error processing data message:", e);
    }
  });

  await session.start({ agent, room });
  sessionRunning = true;
  // 给 SDK 一点点时间完成内部 Activity 绑定
  await new Promise((resolve) => setTimeout(resolve, 100));

  while (pendingUserTexts.length) {
    const t = pendingUserTexts.shift();
    if (!t) continue;
    if (turnMode === "manual") {
      pendingManualTextQueue.push(t);
    } else {
      await respondToUserText(t);
    }
  }
  await processManualTextQueue();
  if (pendingInterview) {
    latestInterview = pendingInterview;
    pendingInterview = null;
    scheduleApplyLatestInterview();
  }

  if (!startInterviewHandled) {
    const interviewOrNull = await Promise.race([
      startInterviewPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);

    if (interviewOrNull) {
      latestInterview = interviewOrNull;
      scheduleApplyLatestInterview();
    } else {
      // 超时兜底：发送通用开场白
      if (!hasGreeted) {
        hasGreeted = true;
        startInterviewHandled = true;
        await sendKickoffWithRetry({
          session,
          userProfile,
        });
      }
    }
  }
}

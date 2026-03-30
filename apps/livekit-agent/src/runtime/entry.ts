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
  loadInterviewMessages,
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
  createConfiguredSTT,
  createConfiguredLLM,
  createConfiguredTTS,
} from "../config/providers";
import {
  saveUserMessage,
  saveAiMessage,
} from "../services/message-persistence";
import { extractKeywordsFromProfile } from "../services/keyword-extractor";
import {
  createKickoffGate,
  hasVisibleConversationMessages,
  sendKickoffWithRetry,
} from "./kickoff";

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
  const llmTraceContext = {
    userId: participant.identity,
    sessionId: room.name,
    traceName: "livekit-agent-session",
    tags: ["livekit-agent", "voice-session"],
    metadata: {
      roomName: room.name,
      participantIdentity: participant.identity,
      locale,
    },
  };

  // 定义Agent如何处理音频输入和输出
  const session = new voice.AgentSession({
    stt: createConfiguredSTT(combinedVocabulary, locale),
    llm: await createConfiguredLLM(participant.identity, llmTraceContext),
    tts: createConfiguredTTS(locale),
    vad: vad,
    // 使用 Turn Detector 多语言模型，基于语义理解判断用户是否说完
    // 可以理解"让我想想..."这类语句，不会在用户思考时打断
    turnDetection: new livekit.turnDetector.MultilingualModel(),
    voiceOptions: {
      // 功能1: Barge-in 打断支持 —— 用户开口时 Agent 自动停止当前 TTS 播放
      // minInterruptionDuration: 用户至少持续说话 300ms 才触发打断，避免环境噪音误触
      // minInterruptionWords: 不限制字数，说话即打断
      allowInterruptions: true,
      minInterruptionDuration: 300,
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
        const msSinceAgentStopped = Date.now() - agentLastStopSpeakingAt;
        // barge-in：用户在 Agent 说话时已有语音活动，Agent 停止后立即处理
        // 回声：Agent 自然说完，冷却期内的输入是 TTS 余音，丢弃
        const isBargein = userSpokeWhileAgentSpeaking;
        const isEcho = !isBargein && msSinceAgentStopped < ECHO_COOLDOWN_MS;
        if (!isEcho) {
          turnCoordinator.handleUserTurnEnd(text);
        } else {
          console.log(
            `[EchoCooldown] Ignoring echo input ${msSinceAgentStopped}ms after agent stopped (no prior user speech)`,
          );
        }
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
      // 如果 Agent 正在说话时检测到用户语音，记录为 barge-in 信号
      if (isAgentCurrentlySpeaking) {
        userSpokeWhileAgentSpeaking = true;
      }
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
      // 过滤掉以"系统："开头的内部指令，不发送到前端
      if (text.startsWith("系统：") || text.startsWith("系统:")) {
        return;
      }

      if (turnMode === "manual") {
        // Manual 模式：前端已在本地显示消息，无需 republish；但仍需写库
        if (latestInterview && typeof latestInterview.id === "string") {
          saveUserMessage(latestInterview.id, text);
        }
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

  // 回声抑制（Echo Suppression）
  // 区分"用户主动打断（barge-in）"和"Agent 自然停止后麦克风拾到的 TTS 余音（回声）"：
  // - barge-in：Agent 说话期间用户有语音活动 → Agent 停止后立即允许输入
  // - 回声：Agent 说话期间无用户语音活动 → Agent 停止后加短冷却，丢弃余音
  const ECHO_COOLDOWN_MS = 800;
  let agentLastStopSpeakingAt = 0;
  let isAgentCurrentlySpeaking = false;
  let userSpokeWhileAgentSpeaking = false;

  session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
    if (ev.newState === "speaking") {
      isAgentCurrentlySpeaking = true;
      userSpokeWhileAgentSpeaking = false; // 每次 Agent 开口重置
    }
    if (ev.oldState === "speaking" && ev.newState !== "speaking") {
      isAgentCurrentlySpeaking = false;
      agentLastStopSpeakingAt = Date.now();
    }
  });

  // state for rpc/order
  let sessionRunning = false;
  let pendingInterview: InterviewContext | null = null;
  const pendingUserTexts: string[] = [];
  let latestInterview: InterviewContext | null = null;
  let applyInterviewScheduled = false;
  const kickoffGate = createKickoffGate();
  const startInterviewLoadStates = new Map<string, "loading" | "loaded">();

  const applyInterview = createInterviewApplier({
    session,
    userId: participant.identity,
    userProfile,
    onToolEvent: (payload) => publishDataToRoom(room, payload),
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

  const maybeKickoffInterview = async (interview: InterviewContext) => {
    const interviewId =
      typeof interview.id === "string"
        ? interview.id
        : String(interview.id || "");

    if (!interviewId) {
      return;
    }

    if (!kickoffGate.begin(interviewId)) {
      console.log(`[Kickoff] Skip duplicate kickoff for ${interviewId}`);
      return;
    }

    try {
      const historyMessages = await loadInterviewMessages(interviewId);
      if (hasVisibleConversationMessages(historyMessages as any)) {
        console.log(
          `[Kickoff] Skip kickoff for ${interviewId} because visible history already exists`,
        );
        kickoffGate.complete(interviewId);
        return;
      }

      await sendKickoffWithRetry({
        session,
        userProfile,
      });
      kickoffGate.complete(interviewId);
    } catch (error) {
      kickoffGate.fail(interviewId);
      console.error(
        `[Kickoff] Failed to send kickoff for ${interviewId}:`,
        error,
      );
    }
  };

  const scheduleApplyLatestInterview = () => {
    if (!sessionRunning) return;
    if (!latestInterview) return;
    if (applyInterviewScheduled) return;
    const interviewToApply = latestInterview;
    applyInterviewScheduled = true;
    setTimeout(async () => {
      applyInterviewScheduled = false;
      if (!sessionRunning || !interviewToApply) return;
      await applyInterview(interviewToApply);
      await maybeKickoffInterview(interviewToApply);
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
        const currentState = startInterviewLoadStates.get(
          startPayload.interviewId,
        );
        if (currentState) {
          console.log(
            `[RPC] Ignoring duplicate start_interview for ${startPayload.interviewId} (${currentState})`,
          );
          return;
        }

        startInterviewLoadStates.set(startPayload.interviewId, "loading");
        const interview = (await loadInterviewContext(
          startPayload.interviewId,
        )) as InterviewContext | null;
        if (!interview) {
          startInterviewLoadStates.delete(startPayload.interviewId);
          console.warn(
            `[RPC] Interview context not found for ${startPayload.interviewId}, skip kickoff/apply`,
          );
          return;
        }

        startInterviewLoadStates.set(startPayload.interviewId, "loaded");
        latestInterview = interview;
        if (!sessionRunning) pendingInterview = interview;
        scheduleApplyLatestInterview();
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
}

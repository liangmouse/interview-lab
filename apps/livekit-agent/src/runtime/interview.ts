import { voice, llm } from "@livekit/agents";
import { loadInterviewMessages } from "../services/context-loader";
import { getCandidateName } from "./profile";
import type { InterviewContext } from "./types";
import { StageManager } from "./fsm/stage-manager";
import { buildStagePrompt } from "./fsm/prompt-builder";
import { InterviewStage } from "./fsm/types";
import { createTools } from "./tools";
import { summarizeStage } from "./fsm/summarizer";
import { InterviewOrchestrator } from "./interview-orchestrator";
import { createLLMForStage } from "../config/providers";

export function createInterviewApplier(args: {
  session: voice.AgentSession;
  userId: string;
  userProfile: unknown;
  onToolEvent?: (payload: Record<string, unknown>) => void;
  hasGreeted?: () => boolean;
  setGreeted?: () => void;
}) {
  const { session, userId, userProfile, onToolEvent, hasGreeted, setGreeted } =
    args;

  let applying: Promise<void> | null = null;
  let queued: InterviewContext | null = null;
  let currentStageManager: StageManager | null = null;
  let stageMonitorTimer: NodeJS.Timeout | null = null;

  const stopStageMonitor = () => {
    if (stageMonitorTimer) {
      clearInterval(stageMonitorTimer);
      stageMonitorTimer = null;
    }
  };

  const doApply = async (interview: InterviewContext) => {
    // 1. 停止之前的监控定时器
    stopStageMonitor();

    // 如果时长缺失或异常，默认设置为 1800秒 (30分钟)
    const safeDurationMinutes =
      typeof interview.duration === "number" && interview.duration > 0
        ? interview.duration
        : 30;
    const totalDurationSeconds = safeDurationMinutes * 60;
    const interviewId =
      typeof interview.id === "string"
        ? interview.id
        : String(interview.id || "");
    const orchestrator = new InterviewOrchestrator({
      interviewId,
      userProfile,
    });
    await orchestrator.ensureReady();
    const planningContext = await orchestrator.getPromptContext();
    const tools = createTools({
      userProfile,
      onToolEvent,
      interviewOrchestrator: orchestrator,
    });

    currentStageManager = new StageManager(totalDurationSeconds);
    let currentStageStartMessageIndex = 0; // 记录当前阶段在历史消息中的开始位置

    // 2. 加载历史面试记录 (上下文恢复)
    let historyMessages: any[] = [];
    if (interviewId) {
      historyMessages = await loadInterviewMessages(interviewId);
    }

    const chatCtx = new llm.ChatContext();
    const visibleHistoryMessages = historyMessages.filter((msg) => {
      const role = msg?.role;
      const content = msg?.content;
      return (
        (role === "user" || role === "assistant") &&
        typeof content === "string" &&
        content.trim().length > 0
      );
    });

    if (visibleHistoryMessages.length > 0) {
      for (const msg of visibleHistoryMessages) {
        chatCtx.addMessage({
          role: msg.role as any,
          content: msg.content,
        });
      }
      console.log(
        `[面试] 恢复了 ${visibleHistoryMessages.length} 条历史消息到上下文。`,
      );
    }

    // 3. 定义 Agent 更新逻辑 (随阶段变化)
    // 功能3: 按阶段动态切换 LLM —— 为新 Agent 实例注入阶段专属 LLM
    // LiveKit SDK 解析 LLM 时优先使用 agent.llm，其次 session.llm；
    // 因此直接在 voice.Agent 构造时传入 llm 即可完成切换，无需额外 API。
    const updateAgentForStage = async (stage: InterviewStage) => {
      const summaries = currentStageManager?.getStageSummaries();
      const newPrompt = buildStagePrompt(
        stage,
        userProfile,
        interview,
        summaries,
        planningContext,
      );
      console.log(`[面试] 更新 Agent 阶段: ${stage}`);

      // 为当前阶段创建专属 LLM（INTRO/CLOSING: 轻量快速, MAIN_TECHNICAL: 强推理）
      let stageLLM: Awaited<ReturnType<typeof createLLMForStage>> | undefined;
      try {
        stageLLM = await createLLMForStage(stage, userId);
      } catch (err) {
        console.warn(`[面试] 阶段 ${stage} LLM 创建失败，保持当前模型:`, err);
      }

      const updatedAgent = new voice.Agent({
        instructions: newPrompt,
        chatCtx, // 注意: 共享同一个 chatCtx 引用 (保持记忆连续)
        tools, // 注入工具能力
        // 功能3: 阶段专属 LLM —— 若创建失败则 undefined，SDK 自动回退到 session.llm
        ...(stageLLM ? { llm: stageLLM } : {}),
      });
      session.updateAgent(updatedAgent);
    };

    // 4. 启动第一阶段 (自我介绍/Intro)
    // 功能3: await 确保初始阶段 LLM 切换完成后再发送开场白
    const initialStage = currentStageManager.getCurrentStage();
    await updateAgentForStage(initialStage);

    // 5. 启动监控循环 (V1: 基于时间的自动流转)
    stageMonitorTimer = setInterval(() => {
      if (!currentStageManager) return;

      // 检查当前阶段是否超时
      if (currentStageManager.isStageOverTime()) {
        const prevStage = currentStageManager.getCurrentStage();
        const next = currentStageManager.transitionToNext();

        if (next) {
          // 异步执行阶段总结
          (async () => {
            // 通过 'items' getter 或内部属性访问原始消息
            // 经脚本验证: chatCtx.messages 为 undefined, 使用 valid 的访问方式或 fallback
            const allMessages =
              (chatCtx as any).messages || (chatCtx as any).items || [];
            // 注意: LiveKit ChatContext.messages getter 返回只读数组
            const stageMessages = allMessages.slice(
              currentStageStartMessageIndex,
            );
            currentStageStartMessageIndex = allMessages.length; // 重置下一阶段的索引

            console.log(
              `[面试] 正在总结阶段 ${prevStage} (${stageMessages.length} 条消息)...`,
            );
            const summary = await summarizeStage(
              prevStage,
              stageMessages,
              userId,
            );
            if (currentStageManager) {
              currentStageManager.addStageSummary(prevStage, summary);
              // 重新更新 Agent 以在 Prompt 中包含新的总结
              // 理想情况下我们在下一次 update 调用时更新，但我们刚刚进行了转换。
              // 所以应该再次调用 updateAgentForStage 或确保下一个 Prompt 包含它。
              // 实际上下一阶段在总结完成前已经开始。
              // 这是一个竞态。理想情况下我们暂停，总结，然后切换。
              // 但对于 V1，我们可以让它自然流动。下一阶段（软技能）将包含 Intro 的总结。
              // 技术面如果切换得快，不会立即包含 Intro 总结。
              // 让我们为了严谨性强制更新，或者接受最终一致性。
              // 更好的流程: 转换 -> 等待总结 -> 更新 Agent。
              // 但阻塞语音对话体验不好。
              // 我们先存储它。如果 Agent 已经为下一阶段更新了，
              // 它直到再次更新前都不会看到这个总结。
              // 如果需要，我们可以在总结后调用 updateAgentForStage(next)。
            }
          })();

          // 功能3: 阶段切换时异步切换 LLM（不阻塞 setInterval，错误已在内部捕获）
          updateAgentForStage(next).catch((err) => {
            console.error(`[面试] 阶段 ${next} updateAgentForStage 失败:`, err);
          });
        } else {
          // 面试全流程结束
          console.log("[面试] 所有阶段均已完成。");
          stopStageMonitor();
        }
      }
    }, 5000); // Check every 5 seconds

    // 6. 等待移交 (遗留逻辑, 确保 session 就绪)
    // 在新架构中，updateAgentForStage 已经执行，
    // 但我们可能希望确保第一个 Agent 在问候前已经是 "active" 状态。
    // FSM 的 updateAgent 调用是立即开始的。

    // 构造并发送开场白
    if (visibleHistoryMessages.length === 0) {
      // 检查是否已经在 entry.ts 的超时兜底逻辑中发送过开场白
      if (hasGreeted && hasGreeted()) {
        console.log("[Interview] 检测到已发送过开场白，跳过重复发送。");
      } else {
        // 标记已发送开场白
        if (setGreeted) setGreeted();

        const candidateName = getCandidateName(userProfile);
        // 功能2: 主动开场白 —— 邀请候选人进行自我介绍，包含教育背景、工作经历和技术栈
        const greeting = candidateName
          ? `你好${candidateName}，欢迎参加本次面试！请先做一个简短的自我介绍，包括你的教育背景、工作经历和技术栈。`
          : "你好，欢迎参加本次面试！请先做一个简短的自我介绍，包括你的教育背景、工作经历和技术栈。";

        // 稍作延迟以确保 Agent 就绪
        setTimeout(() => {
          session.generateReply({
            userInput: "系统：面试开场",
            instructions: `只输出这句固定开场白，不要添加或修改任何内容：${greeting}`,
            // 开场白期间允许用户随时打断（与 Barge-in 配合）
            allowInterruptions: true,
          });
        }, 500);
      }
    } else {
      console.log(
        `[Interview] 检测到已有历史记录(${visibleHistoryMessages.length}条)，跳过开场白。`,
      );
    }
  };

  return async (interview: InterviewContext) => {
    if (applying) {
      queued = interview;
      await applying;
      return;
    }

    applying = (async () => {
      await doApply(interview);
      while (queued) {
        const next = queued;
        queued = null;
        await doApply(next);
      }
    })().finally(() => {
      applying = null;
    });

    await applying;
  };
}

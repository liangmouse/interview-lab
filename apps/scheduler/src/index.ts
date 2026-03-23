import { createCapabilityRegistry } from "@interviewclaw/agent-core";
import {
  initializeLangfuseTelemetry,
  registerLangfuseProcessShutdown,
} from "@interviewclaw/ai-runtime";
import {
  runOneQuestioningJob,
  runOneResumeReviewJob,
} from "@interviewclaw/llm-apps";
import { WorkflowEngine } from "@interviewclaw/workflows";

void initializeLangfuseTelemetry({
  serviceName: "interviewclaw-scheduler",
  exportMode: "batched",
})
  .then(() => {
    registerLangfuseProcessShutdown();
  })
  .catch((error) => {
    console.error(
      "[scheduler] failed to initialize Langfuse telemetry:",
      error,
    );
  });

export class SchedulerService {
  private readonly workflowEngine = new WorkflowEngine();
  private readonly registry = createCapabilityRegistry();
  private timer: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs = 3000;

  runDailyCheckIn(userId: string) {
    const task = this.workflowEngine.schedule({
      dedupeKey: `daily-check-in:${userId}:${new Date().toISOString().slice(0, 10)}`,
      capability: "study_planner",
      trigger: "schedule",
      payload: { userId },
    });

    return this.registry.get("study_planner").resume({
      context: {
        userId,
        locale: "zh-CN",
      },
      previousRun: {
        id: `${task.id}:previous`,
        capability: "study_planner",
        summary: "昨日计划已经生成",
        output: {
          id: "plan-1",
          userId,
          goal: "持续准备面试",
          milestones: ["整理本周目标"],
          dailyChecklist: ["复盘昨天完成情况"],
        },
      },
      signal: "今天的准备计划做得怎么样，需要我给你出几道题测试下吗？",
    });
  }

  startJobWorker() {
    if (this.timer) {
      return;
    }

    const tick = async () => {
      try {
        await runOneResumeReviewJob();
      } catch (error) {
        console.error("[scheduler] resume review worker failed:", error);
      }

      try {
        await runOneQuestioningJob();
      } catch (error) {
        console.error("[scheduler] questioning worker failed:", error);
      }
    };

    const scheduleNext = () => {
      this.timer = setTimeout(async () => {
        await tick();
        scheduleNext();
      }, this.pollIntervalMs);
    };

    void tick().finally(() => {
      scheduleNext();
    });
  }
}

if (process.env.NODE_ENV !== "test") {
  const scheduler = new SchedulerService();
  scheduler.startJobWorker();
  console.log("[scheduler] InterviewClaw scheduler ready");
}

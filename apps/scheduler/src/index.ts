import { createCapabilityRegistry } from "@interviewclaw/agent-core";
import { WorkflowEngine } from "@interviewclaw/workflows";

export class SchedulerService {
  private readonly workflowEngine = new WorkflowEngine();
  private readonly registry = createCapabilityRegistry();

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
}

if (process.env.NODE_ENV !== "test") {
  console.log("[scheduler] InterviewClaw scheduler ready");
}

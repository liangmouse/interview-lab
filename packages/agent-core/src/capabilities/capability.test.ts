import { describe, expect, it } from "vitest";
import { createCapabilityRegistry, type CapabilityContext } from "./capability";

const context: CapabilityContext = {
  userId: "user-1",
  locale: "zh-CN",
};

describe("capability registry", () => {
  it("builds a study plan that can be resumed with progress context", async () => {
    const registry = createCapabilityRegistry();
    const planner = registry.get("study_planner");

    const plan = await planner.plan({
      context,
      goal: "准备下周一前端系统设计面试",
    });
    const resumed = await planner.resume({
      context,
      previousRun: {
        id: "run-1",
        capability: "study_planner",
        summary: plan.summary,
        output: plan.output,
      },
      signal: "今天已经完成第一项，想继续",
    });

    expect(plan.summary).toContain("学习计划");
    expect(resumed.summary).toContain("继续推进");
  });

  it("creates an interview debrief from a mock interview transcript", async () => {
    const registry = createCapabilityRegistry();
    const debrief = registry.get("interview_debrief");

    const result = await debrief.summarize({
      context,
      input:
        "候选人在系统设计题中回答了缓存、削峰与扩容，但没有覆盖一致性和降级策略。",
    });

    expect(result.summary).toContain("面试复盘");
    expect(result.output.nextActions).toHaveLength(3);
  });
});

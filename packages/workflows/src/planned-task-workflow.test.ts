import { describe, expect, it } from "vitest";
import { WorkflowEngine } from "./planned-task-workflow";

describe("WorkflowEngine", () => {
  it("deduplicates the same scheduled task key", () => {
    const engine = new WorkflowEngine();

    const first = engine.schedule({
      dedupeKey: "daily-check-in:user-1:2026-03-12",
      capability: "study_planner",
      trigger: "schedule",
      payload: { userId: "user-1" },
    });
    const second = engine.schedule({
      dedupeKey: "daily-check-in:user-1:2026-03-12",
      capability: "study_planner",
      trigger: "schedule",
      payload: { userId: "user-1" },
    });

    expect(second.id).toBe(first.id);
    expect(engine.listTasks()).toHaveLength(1);
  });

  it("retries a failed task and marks it pending again", () => {
    const engine = new WorkflowEngine();
    const task = engine.schedule({
      dedupeKey: "retry-task",
      capability: "interview_debrief",
      trigger: "manual",
      payload: { interviewId: "interview-1" },
    });

    engine.markFailed(task.id, "temporary error");
    const retried = engine.retry(task.id);

    expect(retried.attempt).toBe(1);
    expect(retried.status).toBe("pending");
  });
});

import type { PlannedTask, WorkflowTrigger } from "@interviewclaw/domain";

type ScheduleInput = {
  dedupeKey: string;
  capability: string;
  trigger: WorkflowTrigger;
  payload: Record<string, unknown>;
};

export class WorkflowEngine {
  private readonly tasks = new Map<string, PlannedTask>();

  schedule(input: ScheduleInput): PlannedTask {
    const existing = this.tasks.get(input.dedupeKey);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const task: PlannedTask = {
      id: `task:${input.dedupeKey}`,
      dedupeKey: input.dedupeKey,
      capability: input.capability,
      trigger: input.trigger,
      payload: input.payload,
      status: "pending",
      attempt: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(input.dedupeKey, task);
    return task;
  }

  markFailed(taskId: string, error: string) {
    const task = this.findById(taskId);
    task.status = "failed";
    task.error = error;
    task.updatedAt = new Date().toISOString();
    return task;
  }

  retry(taskId: string) {
    const task = this.findById(taskId);
    task.status = "pending";
    task.error = undefined;
    task.attempt += 1;
    task.updatedAt = new Date().toISOString();
    return task;
  }

  listTasks() {
    return Array.from(this.tasks.values());
  }

  private findById(taskId: string) {
    const task = Array.from(this.tasks.values()).find(
      (item) => item.id === taskId,
    );
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return task;
  }
}

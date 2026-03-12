export class WorkflowEngine {
  constructor() {
    this.tasks = new Map();
  }
  schedule(input) {
    const existing = this.tasks.get(input.dedupeKey);
    if (existing) {
      return existing;
    }
    const now = new Date().toISOString();
    const task = {
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
  markFailed(taskId, error) {
    const task = this.findById(taskId);
    task.status = "failed";
    task.error = error;
    task.updatedAt = new Date().toISOString();
    return task;
  }
  retry(taskId) {
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
  findById(taskId) {
    const task = Array.from(this.tasks.values()).find(
      (item) => item.id === taskId,
    );
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }
    return task;
  }
}

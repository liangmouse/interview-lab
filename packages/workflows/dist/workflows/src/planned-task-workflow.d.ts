import type { PlannedTask, WorkflowTrigger } from "@interviewclaw/domain";
type ScheduleInput = {
    dedupeKey: string;
    capability: string;
    trigger: WorkflowTrigger;
    payload: Record<string, unknown>;
};
export declare class WorkflowEngine {
    private readonly tasks;
    schedule(input: ScheduleInput): PlannedTask;
    markFailed(taskId: string, error: string): PlannedTask;
    retry(taskId: string): PlannedTask;
    listTasks(): PlannedTask[];
    private findById;
}
export {};

import type { CapabilityRun } from "@interviewclaw/domain";
export type CapabilityName = "job_hunter" | "interview_question_miner" | "mock_interviewer" | "study_planner" | "interview_debrief";
export type CapabilityContext = {
    userId: string;
    locale: string;
};
type PlanArgs = {
    context: CapabilityContext;
    goal: string;
};
type ResumeArgs<TOutput> = {
    context: CapabilityContext;
    previousRun: CapabilityRun<TOutput>;
    signal: string;
};
type SummarizeArgs = {
    context: CapabilityContext;
    input: string;
};
export type Capability<TOutput = unknown> = {
    name: CapabilityName;
    plan(args: PlanArgs): Promise<CapabilityRun<TOutput>>;
    execute(args: PlanArgs): Promise<CapabilityRun<TOutput>>;
    resume(args: ResumeArgs<TOutput>): Promise<CapabilityRun<TOutput>>;
    summarize(args: SummarizeArgs): Promise<CapabilityRun<TOutput>>;
};
export declare function createCapabilityRegistry(): {
    get(name: CapabilityName): Capability<unknown>;
    list(): Capability<unknown>[];
};
export {};

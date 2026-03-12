export type ChannelKind = "web" | "feishu" | "telegram" | "livekit";
export type UserIdentityLink = {
    id: string;
    userId: string;
    channel: ChannelKind;
    externalUserId: string;
    externalTenantId?: string;
    createdAt: string;
};
export type ConversationSession = {
    id: string;
    userId: string;
    channel: ChannelKind;
    threadKey: string;
    createdAt: string;
    updatedAt: string;
};
export type JobTarget = {
    id: string;
    userId: string;
    title: string;
    company?: string;
    sourceUrl?: string;
    notes?: string;
};
export type StudyPlan = {
    id: string;
    userId: string;
    goal: string;
    milestones: string[];
    dailyChecklist: string[];
};
export type InterviewDebrief = {
    id: string;
    userId: string;
    summary: string;
    strengths: string[];
    gaps: string[];
    nextActions: string[];
};
export type PlannedTaskStatus = "pending" | "processing" | "completed" | "failed";
export type WorkflowTrigger = "schedule" | "event" | "manual";
export type PlannedTask = {
    id: string;
    dedupeKey: string;
    capability: string;
    trigger: WorkflowTrigger;
    status: PlannedTaskStatus;
    attempt: number;
    payload: Record<string, unknown>;
    error?: string;
    createdAt: string;
    updatedAt: string;
};
export type CapabilityRun<TOutput = unknown> = {
    id: string;
    capability: string;
    summary: string;
    output: TOutput;
};

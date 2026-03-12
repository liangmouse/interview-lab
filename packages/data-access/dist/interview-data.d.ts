type EmbeddedMessage = {
    content?: string;
    timestamp?: string;
};
type InterviewMessageSource = {
    user_messages?: EmbeddedMessage[];
    ai_messages?: EmbeddedMessage[];
};
type SupabaseLikeClient = {
    from: (table: string) => {
        select: (query: string) => {
            eq: (column: string, value: string) => {
                single?: () => Promise<{
                    data: any;
                    error: {
                        message: string;
                    } | null;
                }>;
                order?: (column: string, options: {
                    ascending: boolean;
                }) => Promise<{
                    data: any[] | null;
                    error: {
                        message: string;
                    } | null;
                }>;
            };
        };
    };
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{
        error: {
            message?: string;
        } | null;
    }>;
};
export declare function normalizeInterviewMessages(source: InterviewMessageSource): {
    role: string;
    content: string | undefined;
    created_at: string | undefined;
}[];
export declare function createInterviewDataAccess(client: SupabaseLikeClient): {
    loadUserProfile(userId: string): Promise<any>;
    loadInterview(interviewId: string): Promise<any>;
    loadInterviewMessages(interviewId: string): Promise<any[]>;
    saveUserMessage(interviewId: string, content: string): Promise<void>;
    saveAiMessage(interviewId: string, content: string): Promise<void>;
};
export declare const interviewDataAccess: {
    loadUserProfile(userId: string): Promise<any>;
    loadInterview(interviewId: string): Promise<any>;
    loadInterviewMessages(interviewId: string): Promise<any[]>;
    saveUserMessage(interviewId: string, content: string): Promise<void>;
    saveAiMessage(interviewId: string, content: string): Promise<void>;
};
export {};

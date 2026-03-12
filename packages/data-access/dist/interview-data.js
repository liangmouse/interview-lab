import { getSupabaseAdminClient } from "./supabase-admin";
export function normalizeInterviewMessages(source) {
    const userMessages = Array.isArray(source.user_messages)
        ? source.user_messages
        : [];
    const aiMessages = Array.isArray(source.ai_messages) ? source.ai_messages : [];
    return [
        ...userMessages.map((msg) => ({
            role: "user",
            content: msg === null || msg === void 0 ? void 0 : msg.content,
            created_at: msg === null || msg === void 0 ? void 0 : msg.timestamp,
        })),
        ...aiMessages.map((msg) => ({
            role: "assistant",
            content: msg === null || msg === void 0 ? void 0 : msg.content,
            created_at: msg === null || msg === void 0 ? void 0 : msg.timestamp,
        })),
    ]
        .filter((msg) => typeof msg.content === "string" && msg.content.trim())
        .sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return ta - tb;
    })
        .map(({ role, content, created_at }) => ({
        role,
        content,
        created_at,
    }));
}
export function createInterviewDataAccess(client) {
    return {
        async loadUserProfile(userId) {
            const query = client
                .from("user_profiles")
                .select("*")
                .eq("user_id", userId);
            const execute = query.single;
            if (!execute) {
                throw new Error("single() is not available for user profile query");
            }
            const { data, error } = await execute();
            if (error) {
                console.warn(`[DataAccess] Error loading profile for ${userId}:`, error.message);
                return null;
            }
            return data;
        },
        async loadInterview(interviewId) {
            const query = client
                .from("interviews")
                .select("*")
                .eq("id", interviewId);
            const execute = query.single;
            if (!execute) {
                throw new Error("single() is not available for interview query");
            }
            const { data, error } = await execute();
            if (error) {
                console.warn(`[DataAccess] Error loading interview for ${interviewId}:`, error.message);
                return null;
            }
            return data;
        },
        async loadInterviewMessages(interviewId) {
            const query = client
                .from("interviews")
                .select("user_messages, ai_messages")
                .eq("id", interviewId);
            const execute = query.single;
            if (!execute) {
                throw new Error("single() is not available for interview messages query");
            }
            const { data, error } = await execute();
            if (error) {
                console.warn(`[DataAccess] Error loading embedded messages for ${interviewId}:`, error.message);
                return [];
            }
            const normalized = normalizeInterviewMessages(data || {});
            if (normalized.length > 0) {
                return normalized;
            }
            const legacyQuery = client
                .from("messages")
                .select("*")
                .eq("interview_id", interviewId);
            const loadLegacy = legacyQuery.order;
            if (!loadLegacy) {
                throw new Error("order() is not available for legacy messages query");
            }
            const { data: legacyMessages, error: legacyError } = await loadLegacy("created_at", { ascending: true });
            if (legacyError) {
                console.warn(`[DataAccess] Error loading legacy messages for ${interviewId}:`, legacyError.message);
                return [];
            }
            return legacyMessages || [];
        },
        async saveUserMessage(interviewId, content) {
            const { error } = await client.rpc("add_user_message", {
                p_interview_id: interviewId,
                p_content: content.trim(),
            });
            if (error) {
                console.error("[DataAccess] Failed to save user message:", error);
            }
        },
        async saveAiMessage(interviewId, content) {
            const { error } = await client.rpc("add_ai_message", {
                p_interview_id: interviewId,
                p_content: content.trim(),
            });
            if (error) {
                console.error("[DataAccess] Failed to save ai message:", error);
            }
        },
    };
}
export const interviewDataAccess = createInterviewDataAccess({
    from(table) {
        return getSupabaseAdminClient().from(table);
    },
    rpc(fn, args) {
        return getSupabaseAdminClient().rpc(fn, args);
    },
});

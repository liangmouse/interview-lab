import { getSupabaseAdminClient } from "./supabase-admin";

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
      eq: (
        column: string,
        value: string,
      ) => {
        single?: () => Promise<{
          data: any;
          error: { message: string } | null;
        }>;
        order?: (
          column: string,
          options: { ascending: boolean },
        ) => Promise<{ data: any[] | null; error: { message: string } | null }>;
      };
    };
  };
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message?: string } | null }>;
};

export function normalizeInterviewMessages(source: InterviewMessageSource) {
  const userMessages = Array.isArray(source.user_messages)
    ? source.user_messages
    : [];
  const aiMessages = Array.isArray(source.ai_messages)
    ? source.ai_messages
    : [];

  return [
    ...userMessages.map((msg) => ({
      role: "user",
      content: msg?.content,
      created_at: msg?.timestamp,
    })),
    ...aiMessages.map((msg) => ({
      role: "assistant",
      content: msg?.content,
      created_at: msg?.timestamp,
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

export function createInterviewDataAccess(client: SupabaseLikeClient) {
  return {
    async loadUserProfile(userId: string) {
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
        console.warn(
          `[DataAccess] Error loading profile for ${userId}:`,
          error.message,
        );
        return null;
      }

      return data;
    },

    async loadInterview(interviewId: string) {
      const query = client.from("interviews").select("*").eq("id", interviewId);
      const execute = query.single;

      if (!execute) {
        throw new Error("single() is not available for interview query");
      }

      const { data, error } = await execute();

      if (error) {
        console.warn(
          `[DataAccess] Error loading interview for ${interviewId}:`,
          error.message,
        );
        return null;
      }

      return data;
    },

    async loadInterviewMessages(interviewId: string) {
      const query = client
        .from("interviews")
        .select("user_messages, ai_messages")
        .eq("id", interviewId);
      const execute = query.single;

      if (!execute) {
        throw new Error(
          "single() is not available for interview messages query",
        );
      }

      const { data, error } = await execute();

      if (error) {
        console.warn(
          `[DataAccess] Error loading embedded messages for ${interviewId}:`,
          error.message,
        );
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

      const { data: legacyMessages, error: legacyError } = await loadLegacy(
        "created_at",
        { ascending: true },
      );

      if (legacyError) {
        console.warn(
          `[DataAccess] Error loading legacy messages for ${interviewId}:`,
          legacyError.message,
        );
        return [];
      }

      return legacyMessages || [];
    },

    async saveUserMessage(interviewId: string, content: string) {
      const { error } = await client.rpc("add_user_message", {
        p_interview_id: interviewId,
        p_content: content.trim(),
      });

      if (error) {
        console.error("[DataAccess] Failed to save user message:", error);
      }
    },

    async saveAiMessage(interviewId: string, content: string) {
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
    return getSupabaseAdminClient().from(table) as unknown as ReturnType<
      SupabaseLikeClient["from"]
    >;
  },
  rpc(fn, args) {
    return getSupabaseAdminClient().rpc(fn, args) as unknown as ReturnType<
      SupabaseLikeClient["rpc"]
    >;
  },
});

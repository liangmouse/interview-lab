import { getSupabaseAdminClient } from "./supabase-admin";

type JsonObject = Record<string, unknown>;

type SupabaseCodingClient = {
  from: (table: string) => {
    select: (query: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        maybeSingle?: () => Promise<{
          data: any;
          error: { message: string } | null;
        }>;
      };
    };
    upsert: (
      values: Record<string, unknown>,
      options?: { onConflict?: string },
    ) => Promise<{ error: { message: string } | null }>;
    update: (values: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
};

export type CodingInterviewSessionRecord = {
  id: string;
  interviewId: string;
  generationSource: string;
  problems: unknown[];
  draftState: JsonObject;
  createdAt: string;
  updatedAt: string;
};

export type UpsertCodingInterviewSessionInput = {
  interviewId: string;
  generationSource: string;
  problems: unknown[];
  draftState: JsonObject;
};

function mapCodingInterviewSessionRow(
  row: Record<string, any>,
): CodingInterviewSessionRecord {
  return {
    id: row.id,
    interviewId: row.interview_id,
    generationSource: row.generation_source,
    problems: Array.isArray(row.problems) ? row.problems : [],
    draftState:
      row.draft_state && typeof row.draft_state === "object"
        ? row.draft_state
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createCodingInterviewDataAccess(client: SupabaseCodingClient) {
  return {
    async loadCodingInterviewSession(interviewId: string) {
      const query = client
        .from("coding_interview_sessions")
        .select("*")
        .eq("interview_id", interviewId);

      if (!query.maybeSingle) {
        throw new Error(
          "maybeSingle() is not available for coding interview session query",
        );
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        throw new Error(
          `Failed to load coding interview session: ${error.message}`,
        );
      }

      if (!data) {
        return null;
      }

      return mapCodingInterviewSessionRow(data);
    },

    async upsertCodingInterviewSession(
      input: UpsertCodingInterviewSessionInput,
    ) {
      const { error } = await client.from("coding_interview_sessions").upsert(
        {
          interview_id: input.interviewId,
          generation_source: input.generationSource,
          problems: input.problems,
          draft_state: input.draftState,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "interview_id" },
      );

      if (error) {
        throw new Error(
          `Failed to upsert coding interview session: ${error.message}`,
        );
      }
    },

    async saveCodingInterviewDraftState(
      interviewId: string,
      draftState: JsonObject,
    ) {
      const { error } = await client
        .from("coding_interview_sessions")
        .update({
          draft_state: draftState,
          updated_at: new Date().toISOString(),
        })
        .eq("interview_id", interviewId);

      if (error) {
        throw new Error(
          `Failed to save coding interview draft state: ${error.message}`,
        );
      }
    },
  };
}

export const codingInterviewDataAccess = createCodingInterviewDataAccess({
  from(table) {
    return getSupabaseAdminClient().from(table) as unknown as ReturnType<
      SupabaseCodingClient["from"]
    >;
  },
});

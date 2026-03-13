import type {
  AuthProfileRecord,
  AuthProfileStore,
  AuthProviderId,
} from "@interviewclaw/ai-runtime";

type SupabaseLikeClient = {
  from: (table: string) => any;
};

type UserOAuthCredentialRow = {
  profile_id: string;
  provider: AuthProviderId;
  credential: AuthProfileRecord["credential"];
  updated_at: string;
};

const TABLE_NAME = "user_oauth_credentials";
const PROFILE_EXPIRY_SAFETY_WINDOW_MS = 60_000;

export function createUserScopedSupabaseAuthProfileStore(input: {
  userId: string;
  supabase: SupabaseLikeClient;
}): AuthProfileStore {
  const { userId, supabase } = input;

  return {
    async getProfile(id) {
      const result = (await supabase
        .from(TABLE_NAME)
        .select("profile_id, provider, credential, updated_at")
        .eq("user_id", userId)
        .eq("profile_id", id)
        .single?.()) as
        | {
            data: UserOAuthCredentialRow | null;
            error: { code?: string; message: string } | null;
          }
        | undefined;

      if (!result) {
        return null;
      }
      if (result.error) {
        if (result.error.code === "PGRST116") {
          return null;
        }
        throw new Error(result.error.message);
      }

      return toRecord(result.data);
    },

    async getProfilesByProvider(providerId) {
      const result = (await supabase
        .from(TABLE_NAME)
        .select("profile_id, provider, credential, updated_at")
        .eq("user_id", userId)
        .eq?.("provider", providerId)
        .maybeSingle?.()) as
        | {
            data: UserOAuthCredentialRow[] | UserOAuthCredentialRow | null;
            error: { message: string } | null;
          }
        | undefined;

      if (!result) {
        return [];
      }
      if (result.error) {
        throw new Error(result.error.message);
      }

      const rows = Array.isArray(result.data)
        ? result.data
        : result.data
          ? [result.data]
          : [];

      return rows
        .map(toRecord)
        .filter((record): record is AuthProfileRecord => record !== null)
        .sort((left, right) => right.updatedAt - left.updatedAt);
    },

    async upsertProfile(record) {
      const response = await supabase.from(TABLE_NAME).upsert(
        {
          user_id: userId,
          profile_id: record.id,
          provider: record.provider,
          credential: record.credential,
          updated_at: new Date(record.updatedAt).toISOString(),
        },
        {
          onConflict: "user_id,provider",
        },
      );

      if (response.error) {
        throw new Error(response.error.message);
      }
    },

    async updateProfile(id, patch) {
      const current = await this.getProfile(id);
      if (!current) {
        throw new Error(`Auth profile not found: ${id}`);
      }

      await this.upsertProfile({
        ...current,
        ...(patch.updatedAt !== undefined
          ? { updatedAt: patch.updatedAt }
          : {}),
        ...(patch.credential ? { credential: { ...patch.credential } } : {}),
      });
    },

    async deleteProfile(id) {
      const result = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq("user_id", userId)
        .eq("profile_id", id)
        .eq("provider", "openai-codex");

      if (result.error) {
        throw new Error(result.error.message);
      }
    },

    isCredentialExpired(record, now = Date.now()) {
      if (!record.credential.expires) {
        return false;
      }
      return record.credential.expires <= now + PROFILE_EXPIRY_SAFETY_WINDOW_MS;
    },
  };
}

function toRecord(
  row: UserOAuthCredentialRow | null,
): AuthProfileRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.profile_id,
    provider: row.provider,
    credential: { ...row.credential },
    updatedAt: Date.parse(row.updated_at),
  };
}

import { createClient } from "@supabase/supabase-js";

type SupabaseEnvInput = Record<string, string | undefined>;

const SUPABASE_API_SETTINGS_URL =
  "https://supabase.com/dashboard/project/_/settings/api";

function getPublicSupabaseKey(env?: SupabaseEnvInput) {
  if (env) {
    return (
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    );
  }

  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  );
}

function createMissingSupabaseEnvError() {
  return new Error(
    [
      "Your project's URL and Key are required to create a Supabase client!",
      "",
      "Set NEXT_PUBLIC_SUPABASE_URL and one of:",
      "- NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
      "",
      "Check your Supabase project's API settings to find these values",
      SUPABASE_API_SETTINGS_URL,
    ].join("\n"),
  );
}

export function getSupabaseAdminEnv(env?: SupabaseEnvInput) {
  return {
    url: env
      ? env.NEXT_PUBLIC_SUPABASE_URL
      : process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: env
      ? env.SUPABASE_SERVICE_ROLE_KEY || getPublicSupabaseKey(env)
      : process.env.SUPABASE_SERVICE_ROLE_KEY || getPublicSupabaseKey(),
  };
}

export function getRequiredSupabaseAdminEnv(env?: SupabaseEnvInput) {
  const { url, key } = getSupabaseAdminEnv(env);
  if (!url || !key) {
    throw createMissingSupabaseEnvError();
  }
  return { url, key };
}

export function createSupabaseAdminClient(env?: SupabaseEnvInput) {
  const { url, key } = getRequiredSupabaseAdminEnv(env);

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

let cachedSupabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | null =
  null;

export function getSupabaseAdminClient() {
  if (!cachedSupabaseAdmin) {
    cachedSupabaseAdmin = createSupabaseAdminClient();
  }

  return cachedSupabaseAdmin;
}

export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, prop) {
      return Reflect.get(getSupabaseAdminClient(), prop);
    },
  },
) as ReturnType<typeof createSupabaseAdminClient>;

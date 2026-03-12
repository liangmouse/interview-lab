const SUPABASE_API_SETTINGS_URL = "https://supabase.com/dashboard/project/_/settings/api";
function getPublicSupabaseKey(env) {
    if (env) {
        return (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
            env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY);
    }
    return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY);
}
function createMissingSupabaseEnvError() {
    return new Error([
        "Your project's URL and Key are required to create a Supabase client!",
        "",
        "Set NEXT_PUBLIC_SUPABASE_URL and one of:",
        "- NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
        "",
        "Check your Supabase project's API settings to find these values",
        SUPABASE_API_SETTINGS_URL,
    ].join("\n"));
}
export function getSupabasePublicEnv(env) {
    return {
        url: env
            ? env.NEXT_PUBLIC_SUPABASE_URL
            : process.env.NEXT_PUBLIC_SUPABASE_URL,
        key: getPublicSupabaseKey(env),
    };
}
export function getRequiredSupabasePublicEnv(env) {
    const { url, key } = getSupabasePublicEnv(env);
    if (!url || !key) {
        throw createMissingSupabaseEnvError();
    }
    return { url, key };
}
export function getSupabaseAdminEnv(env) {
    return {
        url: env
            ? env.NEXT_PUBLIC_SUPABASE_URL
            : process.env.NEXT_PUBLIC_SUPABASE_URL,
        key: (env === null || env === void 0 ? void 0 : env.SUPABASE_SERVICE_ROLE_KEY) || getPublicSupabaseKey(env),
    };
}
export function getRequiredSupabaseAdminEnv(env) {
    const { url, key } = getSupabaseAdminEnv(env);
    if (!url || !key) {
        throw createMissingSupabaseEnvError();
    }
    return { url, key };
}

type SupabaseEnvInput = Record<string, string | undefined>;
export declare function getSupabaseAdminEnv(env?: SupabaseEnvInput): {
    url: string | undefined;
    key: string | undefined;
};
export declare function getRequiredSupabaseAdminEnv(env?: SupabaseEnvInput): {
    url: string;
    key: string;
};
export declare function createSupabaseAdminClient(env?: SupabaseEnvInput): import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
export declare function getSupabaseAdminClient(): import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
export declare const supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>;
export {};

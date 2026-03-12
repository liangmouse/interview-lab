import { createClient } from "@supabase/supabase-js";
import { getRequiredSupabaseAdminEnv } from "@/lib/supabase/env";
// 注意：此客户端用于服务器环境（Next.js API Routes 或 独立 Agent），
// 不应在客户端组件中使用，因为它可能使用 Service Role Key。
const { url: supabaseUrl, key: supabaseKey } = getRequiredSupabaseAdminEnv();
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

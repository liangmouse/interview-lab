import { createBrowserClient } from "@supabase/ssr";
import { getRequiredSupabasePublicEnv } from "@/lib/supabase/env";

export function createClient() {
  const { url, key } = getRequiredSupabasePublicEnv();
  return createBrowserClient(url, key);
}

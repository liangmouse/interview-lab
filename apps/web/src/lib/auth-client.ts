import { createClient } from "@/lib/supabase/client";

export async function loginWithGoogle() {
  const supabase = createClient();
  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

export async function loginWithGithub() {
  const supabase = createClient();
  return await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
}

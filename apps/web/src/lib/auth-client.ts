import { createClient } from "@/lib/supabase/client";
import { getOAuthRedirectTo } from "@/lib/auth-redirect";

function getOAuthRedirectUrl() {
  return getOAuthRedirectTo(window.location.pathname, window.location.origin);
}

export async function loginWithGoogle() {
  const supabase = createClient();
  return await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getOAuthRedirectUrl(),
    },
  });
}

export async function loginWithGithub() {
  const supabase = createClient();
  return await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: getOAuthRedirectUrl(),
    },
  });
}

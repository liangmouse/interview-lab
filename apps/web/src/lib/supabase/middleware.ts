import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { url: supabaseUrl, key: supabaseKey } = getSupabasePublicEnv();

  if (!supabaseUrl || !supabaseKey) {
    // Check if we are in a build environment or simply missing config
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "Supabase environment variables are missing in middleware. Session update skipped.",
      );
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch (error) {
    console.error("Supabase auth check failed in middleware:", error);
  }

  return response;
}

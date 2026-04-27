import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getOrCreateUserProfile } from "@/action/user-profile";
import { getLocalizedAppPath } from "@/lib/auth-redirect";
import { getRequiredSupabasePublicEnv } from "@/lib/supabase/env";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const callbackPath = requestUrl.pathname;
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const signInPath = getLocalizedAppPath(callbackPath, "/auth/sign-in");
  const dashboardPath = getLocalizedAppPath(callbackPath, "/dashboard");
  const getSignInUrl = (message: string) =>
    `${requestUrl.origin}${signInPath}?error=${encodeURIComponent(message)}`;

  // 如果 OAuth 提供者返回了错误
  if (error) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(getSignInUrl("第三方登录失败，请重试"));
  }

  if (!code) {
    return NextResponse.redirect(getSignInUrl("第三方登录失败，请重试"));
  }

  const response = NextResponse.redirect(
    `${requestUrl.origin}${dashboardPath}`,
  );
  const { url, key } = getRequiredSupabasePublicEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  // 如果 OAuth 登录失败，重定向到登录页并显示错误
  if (exchangeError) {
    console.error("Exchange code error:", exchangeError);
    return NextResponse.redirect(getSignInUrl("登录失败，请重试"));
  }

  // 如果OAuth登录成功，确保创建或获取用户资料
  if (data?.user) {
    try {
      await getOrCreateUserProfile(data.user);
    } catch (profileError) {
      console.error("Create profile error:", profileError);
      // 即使创建 profile 失败，也允许登录，因为用户已经认证成功
    }
  }

  // 在登录状态重定向到根页面下的dashboard页面
  return response;
}

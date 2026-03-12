import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateUserProfile } from "@/action/user-profile";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");

  // 如果 OAuth 提供者返回了错误
  if (error) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(
      `${requestUrl.origin}/auth/sign-in?error=${encodeURIComponent("第三方登录失败，请重试")}`,
    );
  }

  if (code) {
    const supabase = await createClient();
    /**- 向 Supabase 的认证服务器发送一个请求，请求中包含了从 URL 中获取的 code 。
           Supabase 服务器验证这个 code 的有效性。
           如果验证通过，服务器会生成一个用户会话（Session），并将其返回给我们的 Next.js 服务器。
           auth-helpers-nextjs 库会自动将这个会话信息（通常是一个 JWT）打包并设置为一个安全的、HttpOnly 的 Cookie，然后附加到当前的响应中。
        */
    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    // 如果 OAuth 登录失败，重定向到登录页并显示错误
    if (exchangeError) {
      console.error("Exchange code error:", exchangeError);
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/sign-in?error=${encodeURIComponent("登录失败，请重试")}`,
      );
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
  }

  // 在登录状态重定向到根页面下的dashboard页面
  return NextResponse.redirect(`${requestUrl.origin}/dashboard`);
}

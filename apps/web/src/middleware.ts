import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { routing } from "@/i18n/routing";

// 创建 next-intl 中间件
const intlMiddleware = createMiddleware(routing);

// 检查路径是否已包含 locale 前缀
function getLocaleFromPath(pathname: string): string | null {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 跳过静态资源和 API
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 处理 Supabase session
  await updateSession(request);

  // 检查路径是否有 locale 前缀
  const localeInPath = getLocaleFromPath(pathname);

  // 如果路径没有 locale 前缀，rewrite 到默认语言（URL 不变）
  // 这是 localePrefix: 'as-needed' 模式的核心逻辑
  if (!localeInPath) {
    const newPathname = `/${routing.defaultLocale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(new URL(newPathname, request.url));
  }

  // 带有 locale 前缀的路径，由 next-intl 处理
  return intlMiddleware(request);
}

export const config = {
  matcher: "/:path*",
};

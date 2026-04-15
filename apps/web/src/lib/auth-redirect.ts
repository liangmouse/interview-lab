import { routing } from "@/i18n/routing";

function getLocaleFromPathname(pathname: string) {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }

  return null;
}

export function getLocalizedAppPath(pathname: string, appPath: string) {
  const locale = getLocaleFromPathname(pathname);

  if (!locale || locale === routing.defaultLocale) {
    return appPath;
  }

  return `/${locale}${appPath}`;
}

export function getOAuthRedirectTo(pathname: string, origin: string) {
  return `${origin}${getLocalizedAppPath(pathname, "/auth/callback")}`;
}

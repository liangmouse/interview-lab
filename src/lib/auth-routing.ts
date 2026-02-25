export type AuthTab = "sign-in" | "sign-up";

const DEFAULT_AUTH_TAB: AuthTab = "sign-in";

export function resolveAuthEntryTarget(
  isLoggedIn: boolean,
): "/auth/sign-in" | "/dashboard" {
  return isLoggedIn ? "/dashboard" : "/auth/sign-in";
}

export function normalizeAuthTab(
  tab: string | string[] | null | undefined,
): AuthTab {
  const value = Array.isArray(tab) ? tab[0] : tab;

  if (value === "sign-up") {
    return "sign-up";
  }

  return DEFAULT_AUTH_TAB;
}

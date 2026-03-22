const OPENAI_CODEX_OAUTH_PROVIDER = "openai-codex";

export const OPENAI_CODEX_OAUTH_COOKIE = "openai-codex-oauth";
export const OPENAI_CODEX_OAUTH_MESSAGE_SOURCE = "openai-codex-oauth";

export type OpenAICodexOAuthMode = "popup" | "redirect";

export type OpenAICodexOAuthCookiePayload = {
  state: string;
  codeVerifier: string;
  returnTo: string;
  userId: string;
  mode?: OpenAICodexOAuthMode;
};

export function getOpenAICodexOAuthProfileId(userId: string) {
  return `${OPENAI_CODEX_OAUTH_PROVIDER}:${userId}`;
}

export function getOpenAICodexCallbackUrl(origin: string) {
  return `${origin}/api/openai-codex/oauth/callback`;
}

export function sanitizeReturnTo(value: string | null | undefined) {
  if (!value) {
    return "/profile";
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/profile";
  }

  return value;
}

export function serializeOpenAICodexOAuthCookie(
  value: OpenAICodexOAuthCookiePayload,
) {
  return JSON.stringify(value);
}

export function parseOpenAICodexOAuthCookie(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(
      decodeURIComponent(value),
    ) as OpenAICodexOAuthCookiePayload;
  } catch {
    try {
      return JSON.parse(value) as OpenAICodexOAuthCookiePayload;
    } catch {
      return null;
    }
  }
}

export function sanitizeOAuthMode(
  value: string | null | undefined,
): OpenAICodexOAuthMode {
  return value === "popup" ? "popup" : "redirect";
}

export function buildOAuthResultReturnUrl(input: {
  origin: string;
  returnTo: string;
  result: "success" | "error";
}) {
  const url = new URL(input.returnTo, input.origin);
  url.searchParams.set("codex_oauth", input.result);
  return url.toString();
}

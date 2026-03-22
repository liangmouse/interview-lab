import { resolveOpenAICodexConfig } from "./config";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
};

export const OPENAI_CODEX_OAUTH_PROVIDER = "openai-codex";

export type OpenAICodexOAuthCredentials = {
  access: string;
  refresh: string;
  expires?: number;
  email?: string | null;
};

export async function refreshOpenAICodexCredential(
  credentials: OpenAICodexOAuthCredentials,
): Promise<OpenAICodexOAuthCredentials> {
  const config = resolveOpenAICodexConfig();
  const response = await fetch(new URL(config.tokenPath, config.authBaseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: config.clientId,
      refresh_token: credentials.refresh,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI Codex OAuth token exchange failed with status ${response.status}`,
    );
  }

  const payload = (await response.json()) as TokenResponse;
  if (!payload.access_token) {
    throw new Error(
      "OpenAI Codex OAuth token response is missing access_token",
    );
  }

  let expires: number | undefined;
  if (typeof payload.expires_at === "number") {
    expires =
      payload.expires_at > 10_000_000_000
        ? payload.expires_at
        : payload.expires_at * 1000;
  } else if (typeof payload.expires_in === "number") {
    expires = Date.now() + payload.expires_in * 1000;
  }

  return {
    access: payload.access_token,
    refresh: payload.refresh_token || credentials.refresh,
    expires,
    email: credentials.email ?? null,
  };
}

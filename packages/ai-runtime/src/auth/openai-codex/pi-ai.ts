import type { OAuthCredentials } from "@mariozechner/pi-ai";
import {
  openaiCodexOAuthProvider,
  refreshOpenAICodexToken,
} from "@mariozechner/pi-ai/oauth";

export type OpenAICodexOAuthCredentials = OAuthCredentials & {
  email?: string | null;
};

export const OPENAI_CODEX_OAUTH_PROVIDER = openaiCodexOAuthProvider.id;

export async function refreshOpenAICodexCredential(
  credentials: OpenAICodexOAuthCredentials,
): Promise<OpenAICodexOAuthCredentials> {
  const refreshed = await refreshOpenAICodexToken(credentials.refresh);

  return {
    ...refreshed,
    email: credentials.email ?? null,
  };
}

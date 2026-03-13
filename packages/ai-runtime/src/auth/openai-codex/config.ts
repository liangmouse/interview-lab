export const DEFAULT_OPENAI_CODEX_AUTH_BASE_URL = "https://auth.openai.com";
export const DEFAULT_OPENAI_CODEX_API_BASE_URL =
  "https://chatgpt.com/backend-api/codex";
export const DEFAULT_OPENAI_CODEX_CLIENT_ID =
  "oai-org.zd7yhr5kSMC8LSt3yVf4DKmQ";
export const DEFAULT_OPENAI_CODEX_AUTHORIZE_PATH = "/oauth/authorize";
export const DEFAULT_OPENAI_CODEX_TOKEN_PATH = "/oauth/token";
export const DEFAULT_OPENAI_CODEX_USERINFO_PATH = "/oauth/userinfo";
export const DEFAULT_OPENAI_CODEX_CALLBACK_PORT = 1455;
export const DEFAULT_OPENAI_CODEX_CALLBACK_HOST = "127.0.0.1";
export const DEFAULT_OPENAI_CODEX_CALLBACK_PATH = "/auth/callback";
export const DEFAULT_OPENAI_CODEX_SCOPE = "openid profile email offline_access";

export type OpenAICodexConfig = {
  authBaseUrl: string;
  apiBaseUrl: string;
  clientId: string;
  authorizePath: string;
  tokenPath: string;
  userinfoPath: string;
  callbackHost: string;
  callbackPort: number;
  callbackPath: string;
  scope: string;
  profileId?: string;
};

function trimString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveOpenAICodexConfig(
  env: NodeJS.ProcessEnv = process.env,
): OpenAICodexConfig {
  const callbackPort = Number(
    trimString(env.OPENAI_CODEX_CALLBACK_PORT) ??
      DEFAULT_OPENAI_CODEX_CALLBACK_PORT,
  );

  if (!Number.isInteger(callbackPort) || callbackPort <= 0) {
    throw new Error("OPENAI_CODEX_CALLBACK_PORT must be a positive integer");
  }

  return {
    authBaseUrl:
      trimString(env.OPENAI_CODEX_AUTH_BASE_URL) ||
      DEFAULT_OPENAI_CODEX_AUTH_BASE_URL,
    apiBaseUrl:
      trimString(env.OPENAI_CODEX_API_BASE_URL) ||
      DEFAULT_OPENAI_CODEX_API_BASE_URL,
    clientId:
      trimString(env.OPENAI_CODEX_CLIENT_ID) || DEFAULT_OPENAI_CODEX_CLIENT_ID,
    authorizePath:
      trimString(env.OPENAI_CODEX_AUTHORIZE_PATH) ||
      DEFAULT_OPENAI_CODEX_AUTHORIZE_PATH,
    tokenPath:
      trimString(env.OPENAI_CODEX_TOKEN_PATH) ||
      DEFAULT_OPENAI_CODEX_TOKEN_PATH,
    userinfoPath:
      trimString(env.OPENAI_CODEX_USERINFO_PATH) ||
      DEFAULT_OPENAI_CODEX_USERINFO_PATH,
    callbackHost: DEFAULT_OPENAI_CODEX_CALLBACK_HOST,
    callbackPort,
    callbackPath: DEFAULT_OPENAI_CODEX_CALLBACK_PATH,
    scope: trimString(env.OPENAI_CODEX_SCOPE) || DEFAULT_OPENAI_CODEX_SCOPE,
    profileId: trimString(env.OPENAI_CODEX_PROFILE_ID),
  };
}

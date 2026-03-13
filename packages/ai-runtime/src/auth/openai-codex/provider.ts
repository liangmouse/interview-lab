import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";
import { createServer } from "node:http";
import { URL } from "node:url";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { AuthProvider, LoginResult, OAuthCredential } from "../provider";
import type { AuthProfileStore } from "../../storage/auth-profiles";
import { resolveOpenAICodexConfig } from "./config";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
};

export type OpenAICodexAuthProviderDeps = {
  env: NodeJS.ProcessEnv;
  profileStore: AuthProfileStore;
  fetch: typeof globalThis.fetch;
  now: () => number;
  randomBytes: (size: number) => Uint8Array;
  openBrowser: (url: string) => Promise<boolean>;
  waitForRedirectUrl: (url: string) => Promise<string>;
  promptForRedirectUrl: (url: string) => Promise<string>;
  log: (message: string) => void;
};

const LOGIN_COMPLETION_MESSAGE =
  "OpenAI Codex login complete. You can close this window.";

export type OpenAICodexAuthorizationContext = {
  authorizationUrl: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
};

type OpenAICodexRuntimeDeps = Pick<
  OpenAICodexAuthProviderDeps,
  "env" | "fetch" | "now" | "randomBytes"
>;

export function createOpenAICodexAuthProvider(
  deps: Partial<OpenAICodexAuthProviderDeps> & {
    profileStore: AuthProfileStore;
  },
): AuthProvider {
  const resolvedDeps = withDefaultDeps(deps);
  const config = resolveOpenAICodexConfig(resolvedDeps.env);

  return {
    async startLogin(input) {
      const remote = Boolean(input?.remote);
      const started = beginOpenAICodexOAuth({
        env: resolvedDeps.env,
        randomBytes: resolvedDeps.randomBytes,
      });

      const redirectCaptureUrl = `${started.redirectUri}?state=${started.state}`;
      if (remote) {
        resolvedDeps.log(
          `OpenAI Codex authorization URL:\n${started.authorizationUrl}\n\nPaste the full redirect URL after login.`,
        );
      } else {
        const opened = await resolvedDeps.openBrowser(started.authorizationUrl);
        if (!opened) {
          resolvedDeps.log(
            `Could not open the browser automatically.\nOpen this URL manually:\n${started.authorizationUrl}`,
          );
        }
      }

      const redirectUrl = remote
        ? await resolvedDeps.promptForRedirectUrl(started.authorizationUrl)
        : await resolvedDeps.waitForRedirectUrl(redirectCaptureUrl);
      const callbackUrl = new URL(redirectUrl);

      return completeOpenAICodexOAuth({
        env: resolvedDeps.env,
        fetch: resolvedDeps.fetch,
        now: resolvedDeps.now,
        profileStore: resolvedDeps.profileStore,
        redirectUri: started.redirectUri,
        code: callbackUrl.searchParams.get("code"),
        state: callbackUrl.searchParams.get("state"),
        expectedState: started.state,
        codeVerifier: started.codeVerifier,
      });
    },

    async loadCredential(profileId) {
      const profile = await selectProfile({
        profileStore: resolvedDeps.profileStore,
        explicitProfileId: profileId,
        configuredProfileId: config.profileId,
      });
      return profile?.credential ?? null;
    },

    async saveCredential(profileId, credential) {
      await resolvedDeps.profileStore.upsertProfile({
        id: profileId,
        provider: "openai-codex",
        credential: { ...credential },
        updatedAt: resolvedDeps.now(),
      });
    },

    async refreshCredential(profileId, credential) {
      if (!credential.refresh) {
        throw new Error(
          "OpenAI Codex OAuth credential has no refresh token; please login again",
        );
      }

      const refreshed = await exchangeRefreshToken({
        deps: resolvedDeps,
        config,
        refreshToken: credential.refresh,
      });
      const email =
        credential.email ||
        (await resolveEmail({
          deps: resolvedDeps,
          config,
          accessToken: refreshed.access,
        }));

      const nextCredential: OAuthCredential = {
        ...refreshed,
        email: email || credential.email,
      };
      await this.saveCredential(profileId, nextCredential);
      return nextCredential;
    },
  };
}

export function beginOpenAICodexOAuth(
  input: Partial<Pick<OpenAICodexRuntimeDeps, "env" | "randomBytes">> & {
    redirectUri?: string;
  } = {},
): OpenAICodexAuthorizationContext {
  const config = resolveOpenAICodexConfig(input.env);
  const randomBytes = input.randomBytes ?? nodeRandomBytes;
  const redirectUri = input.redirectUri ?? buildRedirectUri(config);
  const state = toBase64Url(randomBytes(16));
  const codeVerifier = toBase64Url(randomBytes(32));
  const codeChallenge = toBase64Url(
    createHash("sha256").update(codeVerifier).digest(),
  );
  const authorizationUrl = buildAuthorizeUrl({
    authBaseUrl: config.authBaseUrl,
    authorizePath: config.authorizePath,
    clientId: config.clientId,
    redirectUri,
    scope: config.scope,
    state,
    codeChallenge,
  }).toString();

  return {
    authorizationUrl,
    state,
    codeVerifier,
    redirectUri,
  };
}

export async function completeOpenAICodexOAuth(input: {
  env?: NodeJS.ProcessEnv;
  profileStore: AuthProfileStore;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  redirectUri: string;
  code: string | null;
  state: string | null;
  expectedState: string;
  codeVerifier: string;
  profileId?: string;
}): Promise<LoginResult> {
  if (input.state !== input.expectedState) {
    throw new Error("Invalid OAuth state");
  }
  if (!input.code) {
    throw new Error("OpenAI Codex OAuth callback is missing code");
  }

  const deps = resolveRuntimeDeps(input);
  const config = resolveOpenAICodexConfig(deps.env);
  const credential = await exchangeAuthorizationCode({
    deps: {
      ...deps,
      profileStore: input.profileStore,
      openBrowser: async () => true,
      waitForRedirectUrl: async () => input.redirectUri,
      promptForRedirectUrl: async () => input.redirectUri,
      log: () => undefined,
    },
    config,
    redirectUri: input.redirectUri,
    code: input.code,
    codeVerifier: input.codeVerifier,
  });
  const email = await resolveEmail({
    deps: {
      ...deps,
      profileStore: input.profileStore,
      openBrowser: async () => true,
      waitForRedirectUrl: async () => input.redirectUri,
      promptForRedirectUrl: async () => input.redirectUri,
      log: () => undefined,
    },
    config,
    accessToken: credential.access,
  });

  if (!email) {
    throw new Error("OpenAI Codex OAuth could not determine the account email");
  }

  const finalizedCredential: OAuthCredential = {
    ...credential,
    email,
  };
  const profileId =
    input.profileId || config.profileId || `openai-codex:${email}`;
  await input.profileStore.upsertProfile({
    id: profileId,
    provider: "openai-codex",
    credential: finalizedCredential,
    updatedAt: deps.now(),
  });

  return {
    profileId,
    credential: finalizedCredential,
  };
}

function withDefaultDeps(
  deps: Partial<OpenAICodexAuthProviderDeps> & {
    profileStore: AuthProfileStore;
  },
): OpenAICodexAuthProviderDeps {
  return {
    env: deps.env ?? process.env,
    profileStore: deps.profileStore,
    fetch: deps.fetch ?? globalThis.fetch.bind(globalThis),
    now: deps.now ?? Date.now,
    randomBytes: deps.randomBytes ?? nodeRandomBytes,
    openBrowser: deps.openBrowser ?? defaultOpenBrowser,
    waitForRedirectUrl: deps.waitForRedirectUrl ?? waitForLocalRedirectUrl,
    promptForRedirectUrl: deps.promptForRedirectUrl ?? promptForRedirectUrl,
    log: deps.log ?? console.log,
  };
}

function resolveRuntimeDeps(
  input: Partial<OpenAICodexRuntimeDeps>,
): Required<OpenAICodexRuntimeDeps> {
  return {
    env: input.env ?? process.env,
    fetch: input.fetch ?? globalThis.fetch.bind(globalThis),
    now: input.now ?? Date.now,
    randomBytes: input.randomBytes ?? nodeRandomBytes,
  };
}

async function selectProfile(input: {
  profileStore: AuthProfileStore;
  explicitProfileId?: string;
  configuredProfileId?: string;
}) {
  const targetProfileId = input.explicitProfileId || input.configuredProfileId;
  if (targetProfileId) {
    return input.profileStore.getProfile(targetProfileId);
  }
  const profiles =
    await input.profileStore.getProfilesByProvider("openai-codex");
  return profiles[0] ?? null;
}

function buildAuthorizeUrl(input: {
  authBaseUrl: string;
  authorizePath: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
}) {
  const url = new URL(input.authorizePath, input.authBaseUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", input.scope);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

function buildRedirectUri(config: ReturnType<typeof resolveOpenAICodexConfig>) {
  return `http://${config.callbackHost}:${config.callbackPort}${config.callbackPath}`;
}

async function exchangeAuthorizationCode(input: {
  deps: OpenAICodexAuthProviderDeps;
  config: ReturnType<typeof resolveOpenAICodexConfig>;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<OAuthCredential> {
  const response = await input.deps.fetch(
    new URL(input.config.tokenPath, input.config.authBaseUrl),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: input.config.clientId,
        code: input.code,
        redirect_uri: input.redirectUri,
        code_verifier: input.codeVerifier,
      }),
    },
  );

  return normalizeTokenResponse(response, input.deps.now);
}

async function exchangeRefreshToken(input: {
  deps: OpenAICodexAuthProviderDeps;
  config: ReturnType<typeof resolveOpenAICodexConfig>;
  refreshToken: string;
}): Promise<OAuthCredential> {
  const response = await input.deps.fetch(
    new URL(input.config.tokenPath, input.config.authBaseUrl),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: input.config.clientId,
        refresh_token: input.refreshToken,
      }),
    },
  );

  return normalizeTokenResponse(response, input.deps.now);
}

async function normalizeTokenResponse(
  response: Response,
  now: () => number,
): Promise<OAuthCredential> {
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
    expires = now() + payload.expires_in * 1000;
  }

  return {
    access: payload.access_token,
    refresh: payload.refresh_token,
    expires,
  };
}

async function resolveEmail(input: {
  deps: OpenAICodexAuthProviderDeps;
  config: ReturnType<typeof resolveOpenAICodexConfig>;
  accessToken: string;
}) {
  const response = await input.deps.fetch(
    new URL(input.config.userinfoPath, input.config.authBaseUrl),
    {
      headers: {
        authorization: `Bearer ${input.accessToken}`,
      },
    },
  );

  if (response.ok) {
    const payload = (await response.json()) as Record<string, unknown>;
    const email = firstString([
      payload.email,
      payload.preferred_username,
      payload.upn,
    ]);
    if (email) {
      return email;
    }
  }

  const claims = decodeJwtPayload(input.accessToken);
  return firstString([
    claims.email,
    claims["https://claims.openai.com/email"],
    claims.preferred_username,
  ]);
}

async function defaultOpenBrowser(url: string): Promise<boolean> {
  const { platform } = process;
  const candidates =
    platform === "darwin"
      ? [["open", url]]
      : platform === "win32"
        ? [["cmd", "/c", "start", "", url]]
        : [["xdg-open", url]];

  for (const command of candidates) {
    try {
      const { spawn } = await import("node:child_process");
      const child = spawn(command[0], command.slice(1), {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      return true;
    } catch {
      continue;
    }
  }

  return false;
}

async function waitForLocalRedirectUrl(expectedUrl: string): Promise<string> {
  const expected = new URL(expectedUrl);

  return new Promise<string>((resolve, reject) => {
    const server = createServer((request, response) => {
      if (!request.url) {
        response.statusCode = 400;
        response.end("Missing redirect URL");
        return;
      }

      const requestUrl = new URL(
        request.url,
        `${expected.protocol}//${expected.host}`,
      );
      if (requestUrl.pathname !== expected.pathname) {
        response.statusCode = 404;
        response.end("Not found");
        return;
      }

      response.statusCode = 200;
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(`<html><body>${LOGIN_COMPLETION_MESSAGE}</body></html>`);
      server.close();
      resolve(requestUrl.toString());
    });

    server.once("error", reject);
    server.listen(Number(expected.port), expected.hostname);
  });
}

async function promptForRedirectUrl(_url: string): Promise<string> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question("Paste the full redirect URL: ")).trim();
  } finally {
    rl.close();
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) {
    return {};
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toBase64Url(value: Uint8Array | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function firstString(values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

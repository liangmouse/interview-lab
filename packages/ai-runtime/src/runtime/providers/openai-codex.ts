import { OpenAI } from "openai";
import type { AuthProvider, OAuthCredential } from "../../auth/provider";
import type {
  AuthProfileRecord,
  AuthProfileStore,
} from "../../storage/auth-profiles";
import { resolveOpenAICodexConfig } from "../../auth/openai-codex/config";
import type { RuntimeProvider } from "./types";

export function createOpenAICodexProvider(input: {
  profile: AuthProfileRecord;
  authProvider: AuthProvider;
  profileStore: AuthProfileStore;
  env?: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}): RuntimeProvider {
  const config = resolveOpenAICodexConfig(input.env);
  const rawFetch = input.fetch ?? globalThis.fetch.bind(globalThis);
  const now = input.now ?? Date.now;
  let currentCredential: OAuthCredential = { ...input.profile.credential };

  async function resolveCredential(forceRefresh = false) {
    if (
      forceRefresh ||
      input.profileStore.isCredentialExpired(
        {
          ...input.profile,
          credential: currentCredential,
        },
        now(),
      )
    ) {
      currentCredential = await input.authProvider.refreshCredential(
        input.profile.id,
        currentCredential,
      );
    }

    return currentCredential;
  }

  return {
    id: "openai-codex",
    api: "openai-codex-responses",
    baseURL: config.apiBaseUrl,
    createClientFetch() {
      return async (resource, init) => {
        let credential = await resolveCredential();
        let response = await rawFetch(
          resource,
          withCodexAuth(init, credential.access),
        );

        if (response.status !== 401) {
          return response;
        }

        credential = await resolveCredential(true);
        response = await rawFetch(
          resource,
          withCodexAuth(init, credential.access),
        );
        return response;
      };
    },
    createOpenAIClient(runtimeApiKey = "openai-codex-runtime-token") {
      return new OpenAI({
        apiKey: runtimeApiKey,
        baseURL: config.apiBaseUrl,
        fetch: this.createClientFetch(),
      });
    },
  };
}

function withCodexAuth(
  init: RequestInit | undefined,
  accessToken: string,
): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  const claims = decodeJwtPayload(accessToken);
  const accountId = firstString([
    claims.chatgpt_account_id,
    claims.account_id,
    claims["https://claims.openai.com/account_id"],
  ]);
  if (accountId) {
    headers.set("chatgpt-account-id", accountId);
  }

  return {
    ...init,
    headers,
  };
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

function firstString(values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

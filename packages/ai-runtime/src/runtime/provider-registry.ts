import type { AuthProvider } from "../auth/provider";
import type { AuthProfileStore } from "../storage/auth-profiles";
import { createOpenAIProvider } from "./providers/openai";
import { createOpenAICodexProvider } from "./providers/openai-codex";
import type { ProviderRegistry, RuntimeProvider } from "./providers/types";
import { OPENROUTER_BASE_URL } from "./openai-compatible-config";

export type ProviderRegistryEntryContext = {
  env: NodeJS.ProcessEnv | Record<string, string | undefined>;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
};

export type ProviderRegistryEntry = {
  providerId: string;
  load: (
    context: ProviderRegistryEntryContext,
  ) => Promise<RuntimeProvider | null> | RuntimeProvider | null;
};

type BuildProviderRegistryOptions = ProviderRegistryEntryContext & {
  entries: ProviderRegistryEntry[];
};

export async function buildProviderRegistry(
  options: BuildProviderRegistryOptions,
): Promise<ProviderRegistry> {
  const registry: ProviderRegistry = new Map();
  const context: ProviderRegistryEntryContext = {
    env: options.env ?? process.env,
    fetch: options.fetch,
    now: options.now,
  };

  for (const entry of options.entries) {
    const provider = await entry.load(context);
    if (provider) {
      registry.set(entry.providerId, provider);
    }
  }

  return registry;
}

export function createOpenAIRegistryEntry(input?: {
  providerId?: string;
  apiKeyEnvVar?: string;
  baseUrlEnvVar?: string;
  defaultBaseURL?: string;
  headers?: (
    context: ProviderRegistryEntryContext,
  ) => Record<string, string> | undefined;
}): ProviderRegistryEntry {
  const providerId = input?.providerId ?? "openai";
  const apiKeyEnvVar = input?.apiKeyEnvVar ?? "OPENAI_API_KEY";
  const baseUrlEnvVar = input?.baseUrlEnvVar ?? "OPENAI_BASE_URL";
  const defaultBaseURL = input?.defaultBaseURL;

  return {
    providerId,
    load(context) {
      const apiKey = trimString(context.env[apiKeyEnvVar]);
      if (!apiKey) {
        return null;
      }

      return createOpenAIProvider({
        id: providerId,
        apiKey,
        baseURL: trimString(context.env[baseUrlEnvVar]) ?? defaultBaseURL,
        headers: input?.headers?.(context),
        fetch: context.fetch,
      });
    },
  };
}

export function createOpenRouterRegistryEntry(): ProviderRegistryEntry {
  return {
    providerId: "openrouter",
    load(context) {
      const env = context.env as Record<string, string | undefined>;
      const apiKey =
        trimString(env.OPEN_ROUTER_API_KEY) || trimString(env.OPEN_ROUTER_API);
      if (!apiKey) {
        return null;
      }

      const headers: Record<string, string> = {};
      const referer = trimString(env.OPEN_ROUTER_HTTP_REFERER);
      const title = trimString(env.OPEN_ROUTER_TITLE);

      if (referer) {
        headers["HTTP-Referer"] = referer;
      }

      if (title) {
        headers["X-Title"] = title;
      }

      return createOpenAIProvider({
        id: "openrouter",
        apiKey,
        baseURL: trimString(env.OPEN_ROUTER_BASE_URL) ?? OPENROUTER_BASE_URL,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        fetch: context.fetch,
      });
    },
  };
}

export function createOpenAICodexRegistryEntry(input: {
  profileStore: AuthProfileStore;
  authProvider: AuthProvider;
}): ProviderRegistryEntry {
  return {
    providerId: "openai-codex",
    async load(context) {
      const configuredProfileId = trimString(
        context.env.OPENAI_CODEX_PROFILE_ID,
      );
      let profile = configuredProfileId
        ? await input.profileStore.getProfile(configuredProfileId)
        : ((
            await input.profileStore.getProfilesByProvider("openai-codex")
          )[0] ?? null);

      const now = context.now?.() ?? Date.now();
      if (profile && input.profileStore.isCredentialExpired(profile, now)) {
        try {
          const refreshedCredential =
            await input.authProvider.refreshCredential(
              profile.id,
              profile.credential,
            );
          profile = {
            ...profile,
            credential: refreshedCredential,
            updatedAt: now,
          };
        } catch {
          profile = null;
        }
      }

      if (!profile) {
        return null;
      }

      return createOpenAICodexProvider({
        profile,
        authProvider: input.authProvider,
        profileStore: input.profileStore,
        env: context.env as NodeJS.ProcessEnv,
        fetch: context.fetch,
        now: context.now,
      });
    },
  };
}

function trimString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

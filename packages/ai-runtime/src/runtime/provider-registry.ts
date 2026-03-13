import type { AuthProvider } from "../auth/provider";
import type { AuthProfileStore } from "../storage/auth-profiles";
import { createOpenAIProvider } from "./providers/openai";
import { createOpenAICodexProvider } from "./providers/openai-codex";
import type { ProviderRegistry, RuntimeProvider } from "./providers/types";

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
  apiKeyEnvVar?: string;
  baseUrlEnvVar?: string;
}): ProviderRegistryEntry {
  const apiKeyEnvVar = input?.apiKeyEnvVar ?? "OPENAI_API_KEY";
  const baseUrlEnvVar = input?.baseUrlEnvVar ?? "OPENAI_BASE_URL";

  return {
    providerId: "openai",
    load(context) {
      const apiKey = trimString(context.env[apiKeyEnvVar]);
      if (!apiKey) {
        return null;
      }

      return createOpenAIProvider({
        apiKey,
        baseURL: trimString(context.env[baseUrlEnvVar]),
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

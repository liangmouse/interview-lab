import { describe, expect, it, vi } from "vitest";
import {
  buildProviderRegistry,
  createOpenAICodexRegistryEntry,
  createOpenAIRegistryEntry,
  createOpenRouterRegistryEntry,
  type ProviderRegistryEntry,
} from "./provider-registry";
import { resolveModelRoute } from "./model-routing";
import { createAuthProfileStore } from "../storage/auth-profiles";
import type { AuthProvider } from "../auth/provider";
import type { RuntimeProvider } from "./providers/types";

describe("runtime/provider-registry", () => {
  function createInMemoryStore(records = []) {
    return createAuthProfileStore({
      initialRecords: records,
    });
  }

  function createAuthProvider() {
    return {
      startLogin: vi.fn(),
      loadCredential: vi.fn(),
      saveCredential: vi.fn(),
      refreshCredential: vi.fn(),
    } satisfies AuthProvider;
  }

  it("registers only openai when OPENAI_API_KEY is present", async () => {
    const registry = await buildProviderRegistry({
      env: { OPENAI_API_KEY: "sk-openai" },
      entries: [createOpenAIRegistryEntry()],
    });

    expect(Array.from(registry.keys())).toEqual(["openai"]);
  });

  it("registers openrouter when the OpenRouter key is present", async () => {
    const registry = await buildProviderRegistry({
      env: { OPEN_ROUTER_API_KEY: "or-key" },
      entries: [createOpenRouterRegistryEntry()],
    });

    expect(Array.from(registry.keys())).toEqual(["openrouter"]);
  });

  it("accepts the OPEN_ROUTER_API alias and forwards OpenRouter headers", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response("ok", { status: 200 }));
    const registry = await buildProviderRegistry({
      env: {
        OPEN_ROUTER_API: "or-key",
        OPEN_ROUTER_HTTP_REFERER: "https://example.com",
        OPEN_ROUTER_TITLE: "InterviewClaw",
      },
      fetch,
      entries: [createOpenRouterRegistryEntry()],
    });

    const provider = registry.get("openrouter");
    expect(provider).toBeDefined();

    await provider?.createClientFetch()(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
      },
    );

    const [, init] = fetch.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer or-key");
    expect(headers.get("HTTP-Referer")).toBe("https://example.com");
    expect(headers.get("X-Title")).toBe("InterviewClaw");
  });

  it("registers only openai-codex when a codex profile exists", async () => {
    const registry = await buildProviderRegistry({
      env: {},
      entries: [
        createOpenAICodexRegistryEntry({
          profileStore: createInMemoryStore([
            {
              id: "openai-codex:user@example.com",
              provider: "openai-codex",
              updatedAt: 1,
              credential: {
                access: "access-token",
                refresh: "refresh-token",
                email: "user@example.com",
                expires: Date.now() + 60_000,
              },
            },
          ]),
          authProvider: createAuthProvider(),
        }),
      ],
    });

    expect(Array.from(registry.keys())).toEqual(["openai-codex"]);
  });

  it("resolves openai-codex/gpt-5.4 to the codex provider", async () => {
    const registry = await buildProviderRegistry({
      env: {},
      entries: [
        createOpenAICodexRegistryEntry({
          profileStore: createInMemoryStore([
            {
              id: "openai-codex:user@example.com",
              provider: "openai-codex",
              updatedAt: 1,
              credential: {
                access: "access-token",
                refresh: "refresh-token",
                email: "user@example.com",
                expires: Date.now() + 60_000,
              },
            },
          ]),
          authProvider: createAuthProvider(),
        }),
      ],
    });

    await expect(
      resolveModelRoute("openai-codex/gpt-5.4", registry),
    ).resolves.toMatchObject({
      provider: expect.objectContaining({ id: "openai-codex" }),
      providerId: "openai-codex",
      model: "gpt-5.4",
    });
  });

  it("refreshes an expired codex profile during registry build", async () => {
    const authProvider = createAuthProvider();
    authProvider.refreshCredential = vi.fn(async () => ({
      access: "refreshed-access-token",
      refresh: "refresh-token",
      email: "user@example.com",
      expires: Date.now() + 60_000,
    }));

    const registry = await buildProviderRegistry({
      env: {},
      entries: [
        createOpenAICodexRegistryEntry({
          profileStore: createInMemoryStore([
            {
              id: "openai-codex:user@example.com",
              provider: "openai-codex",
              updatedAt: 1,
              credential: {
                access: "expired-access-token",
                refresh: "refresh-token",
                email: "user@example.com",
                expires: Date.now() - 1,
              },
            },
          ]),
          authProvider,
        }),
      ],
    });

    expect(authProvider.refreshCredential).toHaveBeenCalledTimes(1);
    expect(registry.get("openai-codex")).toBeDefined();
  });

  it("throws a generic error when the requested provider is not registered", async () => {
    const registry = await buildProviderRegistry({
      env: {},
      entries: [],
    });

    await expect(resolveModelRoute("openai/gpt-5.4", registry)).rejects.toThrow(
      "Provider `openai` is not configured",
    );
  });

  it("supports custom provider entries without changing registry logic", async () => {
    const anthropicProvider: RuntimeProvider = {
      id: "anthropic",
      api: "anthropic-messages",
      baseURL: "https://api.anthropic.com/v1",
      createClientFetch: vi.fn(() => globalThis.fetch),
      createOpenAIClient: vi.fn(() => {
        throw new Error("not used in this test");
      }),
    };
    const anthropicEntry: ProviderRegistryEntry = {
      providerId: "anthropic",
      load: () => anthropicProvider,
    };

    const registry = await buildProviderRegistry({
      env: {},
      entries: [anthropicEntry],
    });

    await expect(
      resolveModelRoute("anthropic/claude-sonnet-4", registry),
    ).resolves.toMatchObject({
      providerId: "anthropic",
      model: "claude-sonnet-4",
      provider: anthropicProvider,
    });
  });
});

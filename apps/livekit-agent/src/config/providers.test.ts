import { beforeEach, describe, expect, it, vi } from "vitest";

const llmConstructor = vi.fn();
const resolveModelRoute = vi.fn();
const buildProviderRegistry = vi.fn();
const createAuthProfileStore = vi.fn(() => ({ kind: "profile-store" }));
const createOpenAICodexAuthProvider = vi.fn(() => ({ kind: "codex-auth" }));
const createOpenAIRegistryEntry = vi.fn(() => ({ providerId: "openai" }));
const createOpenAICodexRegistryEntry = vi.fn(() => ({
  providerId: "openai-codex",
}));
const createUserScopedSupabaseAuthProfileStore = vi.fn(() => ({
  kind: "user-scoped-profile-store",
}));
const getSupabaseAdminClient = vi.fn(() => ({ kind: "supabase-admin" }));

vi.mock("@livekit/agents-plugin-openai", () => {
  return {
    LLM: vi.fn(function MockLLM(this: unknown, opts: unknown) {
      llmConstructor(opts);
      return { kind: "openai-llm", opts };
    }),
  };
});

vi.mock("@interviewclaw/ai-runtime", () => {
  return {
    buildProviderRegistry,
    resolveModelRoute,
    createAuthProfileStore,
    createOpenAICodexAuthProvider,
    createOpenAIRegistryEntry,
    createOpenAICodexRegistryEntry,
  };
});

vi.mock("@interviewclaw/data-access", () => {
  return {
    createUserScopedSupabaseAuthProfileStore,
    getSupabaseAdminClient,
  };
});

describe("config/providers.createConfiguredLLM", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.AGENT_LLM_MODEL;
    process.env.GEMINI_API_KEY = "gemini-key";
  });

  it("uses Gemini by default when AGENT_LLM_MODEL is not set", async () => {
    const providers = await import("./providers");

    const llm = await providers.createConfiguredLLM();

    expect(llm).toMatchObject({ kind: "openai-llm" });
    expect(buildProviderRegistry).not.toHaveBeenCalled();
    expect(llmConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "gemini-key",
        model: providers.DEFAULT_GEMINI_MODEL,
        baseURL: providers.GEMINI_BASE_URL,
      }),
    );
  });

  it("routes openai-codex models through the shared registry", async () => {
    buildProviderRegistry.mockResolvedValue(new Map([["openai-codex", {}]]));
    resolveModelRoute.mockResolvedValue({
      providerId: "openai-codex",
      model: "gpt-5.4",
      provider: {
        baseURL: "https://chatgpt.com/backend-api/codex",
        createClientFetch: vi.fn(() => async () => new Response("{}")),
        createOpenAIClient: vi.fn(() => ({ kind: "openai-client" })),
      },
    });
    process.env.AGENT_LLM_MODEL = "openai-codex/gpt-5.4";

    const providers = await import("./providers");

    await providers.createConfiguredLLM("user-1");

    expect(buildProviderRegistry).toHaveBeenCalledTimes(1);
    expect(createUserScopedSupabaseAuthProfileStore).toHaveBeenCalledWith({
      userId: "user-1",
      supabase: { kind: "supabase-admin" },
    });
    expect(createOpenAIRegistryEntry).toHaveBeenCalledTimes(1);
    expect(createOpenAICodexRegistryEntry).toHaveBeenCalledWith({
      profileStore: { kind: "user-scoped-profile-store" },
      authProvider: { kind: "codex-auth" },
    });
    expect(resolveModelRoute).toHaveBeenCalledWith(
      "openai-codex/gpt-5.4",
      expect.any(Map),
    );
    expect(llmConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.4",
        apiKey: "openai-codex-runtime-token",
        baseURL: "https://chatgpt.com/backend-api/codex",
      }),
    );
  });

  it("requires userId for openai-codex models", async () => {
    process.env.AGENT_LLM_MODEL = "openai-codex/gpt-5.4";

    const providers = await import("./providers");

    await expect(providers.createConfiguredLLM()).rejects.toThrow(
      "openai-codex models require a userId",
    );
  });
});

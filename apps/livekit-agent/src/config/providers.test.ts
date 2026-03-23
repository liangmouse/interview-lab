import { beforeEach, describe, expect, it, vi } from "vitest";

const llmConstructor = vi.fn();
const createOpenAIProviderClient = vi.fn(() => ({ kind: "sdk-openai-client" }));
const resolveModelRoute = vi.fn();
const resolveAiModelRoute = vi.fn(
  ({ useCase, userTier }: { useCase: string; userTier?: string }) => {
    if (useCase === "interview-summary") {
      return {
        useCase,
        userTier: userTier ?? "premium",
        providerId: "openrouter",
        model: "openai/gpt-5.4-mini",
        fallbackModels: ["gpt-5.4-mini"],
        temperature: 0.3,
      };
    }

    if (process.env.OPEN_ROUTER_API_KEY?.trim()) {
      return {
        useCase,
        userTier: userTier ?? "premium",
        providerId: "openrouter",
        model: "openai/gpt-5.4",
        fallbackModels: ["gpt-5.4"],
        temperature: 0.7,
      };
    }

    return {
      useCase,
      userTier: userTier ?? "premium",
      providerId: "gemini",
      model: process.env.GEMINI_MODEL?.trim() || "gemini-3-flash-preview",
      fallbackModels: [],
      temperature: 0.7,
    };
  },
);
const buildProviderRegistry = vi.fn();
const createAuthProfileStore = vi.fn(() => ({ kind: "profile-store" }));
const createOpenAICodexAuthProvider = vi.fn(() => ({ kind: "codex-auth" }));
const createOpenAIProvider = vi.fn((input: any) => ({
  kind: "runtime-provider",
  input,
  createOpenAIClient: createOpenAIProviderClient,
}));
const observeOpenAIClient = vi.fn((client: any, tracing: any) => ({
  ...client,
  observed: true,
  tracing,
}));
const createOpenRouterRegistryEntry = vi.fn(() => ({
  providerId: "openrouter",
  load: vi.fn(() => ({
    createOpenAIClient: vi.fn(() => ({ kind: "sdk-openai-client" })),
  })),
}));
const createOpenAIRegistryEntry = vi.fn(() => ({ providerId: "openai" }));
const createOpenAICodexRegistryEntry = vi.fn(() => ({
  providerId: "openai-codex",
}));
const createTtsFromConfig = vi.fn((config) => ({
  kind: `${config.providerId}-tts`,
  config,
}));
const resolveTtsConfig = vi.fn((locale?: string) => ({
  providerId: "openrouter",
  apiKey:
    process.env.TTS_API_KEY?.trim() ??
    process.env.OPEN_ROUTER_API_KEY?.trim() ??
    "",
  model: process.env.TTS_MODEL?.trim() ?? "openai/gpt-audio-mini",
  baseURL: process.env.TTS_BASE_URL?.trim() ?? "https://openrouter.ai/api/v1",
  voice: locale?.toLowerCase().startsWith("en") ? "alloy-en" : "alloy-zh",
  sampleRate: 24000,
  audioFormat: "pcm",
}));
const createUserScopedSupabaseAuthProfileStore = vi.fn(() => ({
  kind: "user-scoped-profile-store",
}));
const getSupabaseAdminClient = vi.fn(() => ({ kind: "supabase-admin" }));
const resolveOpenAICompatibleProviderConfig = vi.fn(
  ({
    providerId,
    defaultModel,
  }: {
    providerId: string;
    defaultModel: string;
  }) => {
    if (providerId === "openrouter") {
      return {
        providerId: "openrouter",
        apiKey: process.env.OPEN_ROUTER_API_KEY?.trim() ?? "",
        baseURL:
          process.env.OPEN_ROUTER_BASE_URL?.trim() ??
          "https://openrouter.ai/api/v1",
        model: defaultModel,
        headers:
          process.env.OPEN_ROUTER_HTTP_REFERER?.trim() ||
          process.env.OPEN_ROUTER_TITLE?.trim()
            ? {
                ...(process.env.OPEN_ROUTER_HTTP_REFERER?.trim()
                  ? {
                      "HTTP-Referer":
                        process.env.OPEN_ROUTER_HTTP_REFERER.trim(),
                    }
                  : {}),
                ...(process.env.OPEN_ROUTER_TITLE?.trim()
                  ? { "X-Title": process.env.OPEN_ROUTER_TITLE.trim() }
                  : {}),
              }
            : undefined,
      };
    }

    return {
      providerId: "gemini",
      apiKey: process.env.GEMINI_API_KEY?.trim() ?? "",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: defaultModel,
    };
  },
);

vi.mock("@livekit/agents-plugin-deepgram", () => ({
  STT: vi.fn(() => ({ kind: "deepgram-stt" })),
}));

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
    createOpenAIProvider,
    createOpenRouterRegistryEntry,
    createOpenAIRegistryEntry,
    createOpenAICodexRegistryEntry,
    observeOpenAIClient,
    resolveAiModelRoute,
    mergeLangfuseTracingContext: (...contexts: any[]) =>
      contexts.filter(Boolean).reduce(
        (acc: any, current: any) => ({
          ...acc,
          ...current,
          metadata: {
            ...(acc?.metadata ?? {}),
            ...(current?.metadata ?? {}),
          },
          tags: [...(acc?.tags ?? []), ...(current?.tags ?? [])],
        }),
        undefined,
      ),
    resolveOpenAICompatibleProviderConfig,
  };
});

vi.mock("@interviewclaw/data-access", () => {
  return {
    createUserScopedSupabaseAuthProfileStore,
    getSupabaseAdminClient,
  };
});

vi.mock("../plugins/tts", () => {
  return {
    createTtsFromConfig,
    resolveTtsConfig,
  };
});

describe("config/providers.createConfiguredLLM", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.AGENT_LLM_MODEL;
    process.env.GEMINI_API_KEY = "gemini-key";
    delete process.env.OPEN_ROUTER_API_KEY;
    delete process.env.OPEN_ROUTER_MODEL;
    delete process.env.OPEN_ROUTER_HTTP_REFERER;
    delete process.env.OPEN_ROUTER_TITLE;
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
  });

  it("uses the policy-selected OpenRouter model by default", async () => {
    process.env.OPEN_ROUTER_API_KEY = "or-key";

    const providers = await import("./providers");

    const llm = await providers.createConfiguredLLM();

    expect(llm).toMatchObject({ kind: "openai-llm" });
    expect(buildProviderRegistry).not.toHaveBeenCalled();
    expect(createOpenAIProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "openrouter",
        apiKey: "or-key",
        baseURL: "https://openrouter.ai/api/v1",
      }),
    );
    expect(llmConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "or-key",
        model: "openai/gpt-5.4",
        baseURL: "https://openrouter.ai/api/v1",
        client: expect.objectContaining({
          kind: "sdk-openai-client",
          observed: true,
        }),
      }),
    );
  });

  it("forwards OpenRouter headers through the observed OpenAI client", async () => {
    process.env.OPEN_ROUTER_API_KEY = "or-key";
    process.env.OPEN_ROUTER_HTTP_REFERER = "https://example.com";
    process.env.OPEN_ROUTER_TITLE = "InterviewClaw";

    const providers = await import("./providers");

    await providers.createConfiguredLLM();

    expect(createOpenAIProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "openrouter",
        apiKey: "or-key",
        baseURL: "https://openrouter.ai/api/v1",
        headers: {
          "HTTP-Referer": "https://example.com",
          "X-Title": "InterviewClaw",
        },
      }),
    );
    expect(createOpenAIProviderClient).toHaveBeenCalledWith("or-key");
    expect(observeOpenAIClient).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "sdk-openai-client" }),
      expect.objectContaining({
        traceName: "livekit-agent-llm",
        tags: expect.arrayContaining(["livekit-agent", "openrouter"]),
        metadata: expect.objectContaining({
          providerId: "openrouter",
          model: "openai/gpt-5.4",
        }),
      }),
    );
    expect(llmConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        client: expect.objectContaining({ kind: "sdk-openai-client" }),
      }),
    );
  });

  it("falls back to Gemini when OpenRouter is not configured", async () => {
    const providers = await import("./providers");

    await providers.createConfiguredLLM();

    expect(createOpenAIProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "gemini",
        apiKey: "gemini-key",
        baseURL: providers.GEMINI_BASE_URL,
      }),
    );
    expect(llmConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "gemini-key",
        model: providers.DEFAULT_GEMINI_MODEL,
        baseURL: providers.GEMINI_BASE_URL,
        temperature: 0.7,
        client: expect.objectContaining({
          kind: "sdk-openai-client",
          observed: true,
        }),
      }),
    );
  });

  it("uses the interview-summary policy when requested", async () => {
    process.env.OPEN_ROUTER_API_KEY = "or-key";

    const providers = await import("./providers");

    await providers.createConfiguredLLM(
      "user-1",
      { traceName: "summary" },
      { useCase: "interview-summary" },
    );

    expect(resolveAiModelRoute).toHaveBeenCalledWith({
      useCase: "interview-summary",
      userTier: undefined,
    });
    expect(llmConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "openai/gpt-5.4-mini",
        temperature: 0.3,
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
    expect(createOpenRouterRegistryEntry).toHaveBeenCalledTimes(1);
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
        client: expect.objectContaining({
          kind: "openai-client",
          observed: true,
        }),
      }),
    );
    expect(observeOpenAIClient).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "openai-client" }),
      expect.objectContaining({
        userId: "user-1",
        traceName: "livekit-agent-routed-llm",
        tags: expect.arrayContaining(["livekit-agent", "openai-codex"]),
        metadata: expect.objectContaining({
          providerId: "openai-codex",
          model: "gpt-5.4",
        }),
      }),
    );
  });

  it("routes openrouter models through the shared registry", async () => {
    buildProviderRegistry.mockResolvedValue(new Map([["openrouter", {}]]));
    resolveModelRoute.mockResolvedValue({
      providerId: "openrouter",
      model: "google/gemini-2.5-flash",
      provider: {
        baseURL: "https://openrouter.ai/api/v1",
        createClientFetch: vi.fn(() => async () => new Response("{}")),
        createOpenAIClient: vi.fn(() => ({ kind: "openai-client" })),
      },
    });
    process.env.AGENT_LLM_MODEL = "openrouter/google/gemini-2.5-flash";

    const providers = await import("./providers");

    await providers.createConfiguredLLM("user-1");

    expect(resolveModelRoute).toHaveBeenCalledWith(
      "openrouter/google/gemini-2.5-flash",
      expect.any(Map),
    );
    expect(llmConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "google/gemini-2.5-flash",
        apiKey: "openai-codex-runtime-token",
        baseURL: "https://openrouter.ai/api/v1",
        client: expect.objectContaining({
          kind: "openai-client",
          observed: true,
        }),
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

describe("config/providers.createConfiguredTTS", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.TTS_MODEL;
    delete process.env.TTS_API_KEY;
    delete process.env.TTS_BASE_URL;
  });

  it("creates an OpenRouter TTS instance by default", async () => {
    const providers = await import("./providers");

    const tts = providers.createConfiguredTTS("zh-CN");

    expect(resolveTtsConfig).toHaveBeenCalledWith("zh-CN", undefined);
    expect(createTtsFromConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "openrouter",
        model: "openai/gpt-audio-mini",
      }),
    );
    expect(tts).toMatchObject({ kind: "openrouter-tts" });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { MockChatOpenAI, MockOpenAIEmbeddings, MockLangfuseCallbackHandler } =
  vi.hoisted(() => {
    const MockChatOpenAI = vi.fn(function (this: unknown, opts: unknown) {
      return { _type: "ChatOpenAI", opts };
    });
    const MockOpenAIEmbeddings = vi.fn(function (this: unknown, opts: unknown) {
      return { _type: "OpenAIEmbeddings", opts };
    });
    const MockLangfuseCallbackHandler = vi.fn(function (
      this: unknown,
      opts: unknown,
    ) {
      return { _type: "LangfuseCallbackHandler", opts };
    });
    return {
      MockChatOpenAI,
      MockOpenAIEmbeddings,
      MockLangfuseCallbackHandler,
    };
  });

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: MockChatOpenAI,
  OpenAIEmbeddings: MockOpenAIEmbeddings,
}));

vi.mock("@langfuse/langchain", () => ({
  CallbackHandler: MockLangfuseCallbackHandler,
}));

import {
  createLangChainChatModel,
  createLangChainEmbeddings,
  createLangChainChatModelForUseCase,
  createLangChainEmbeddingsForUseCase,
} from "./langchain-factories";

describe("langchain-factories", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPEN_ROUTER_API_KEY;
    delete process.env.OPEN_ROUTER_API;
    delete process.env.OPEN_ROUTER_BASE_URL;
    delete process.env.OPEN_ROUTER_MODEL;
    delete process.env.OPEN_ROUTER_EMBEDDING_MODEL;
    delete process.env.OPEN_ROUTER_HTTP_REFERER;
    delete process.env.OPEN_ROUTER_TITLE;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_MODEL;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_EMBEDDING_MODEL;
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_ENABLED;
    delete process.env.LANGFUSE_RELEASE;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.GIT_COMMIT_SHA;
  });

  afterEach(() => {
    for (const key of [
      "OPEN_ROUTER_API_KEY",
      "OPEN_ROUTER_API",
      "OPEN_ROUTER_BASE_URL",
      "OPEN_ROUTER_MODEL",
      "OPEN_ROUTER_EMBEDDING_MODEL",
      "OPEN_ROUTER_HTTP_REFERER",
      "OPEN_ROUTER_TITLE",
      "OPENAI_API_KEY",
      "OPENAI_BASE_URL",
      "OPENAI_MODEL",
      "GEMINI_API_KEY",
      "GEMINI_MODEL",
      "GEMINI_EMBEDDING_MODEL",
      "LANGFUSE_PUBLIC_KEY",
      "LANGFUSE_SECRET_KEY",
      "LANGFUSE_ENABLED",
      "LANGFUSE_RELEASE",
      "VERCEL_GIT_COMMIT_SHA",
      "GIT_COMMIT_SHA",
    ]) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  describe("createLangChainChatModel", () => {
    it("uses OpenRouter config when OPEN_ROUTER_API_KEY is set", () => {
      process.env.OPEN_ROUTER_API_KEY = "or-key";
      process.env.OPEN_ROUTER_HTTP_REFERER = "https://example.com";
      process.env.OPEN_ROUTER_TITLE = "InterviewClaw";

      createLangChainChatModel();

      const callArg = MockChatOpenAI.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const configuration = callArg.configuration as Record<string, unknown>;
      expect(callArg.apiKey).toBe("or-key");
      expect(callArg.model).toBe("google/gemini-2.5-flash");
      expect(configuration.baseURL).toBe("https://openrouter.ai/api/v1");
      expect(configuration.defaultHeaders).toEqual({
        "HTTP-Referer": "https://example.com",
        "X-Title": "InterviewClaw",
      });
    });

    it("uses OPENAI_API_KEY when only OPENAI_API_KEY is set (default OpenAI config)", () => {
      process.env.OPENAI_API_KEY = "sk-test-openai";

      createLangChainChatModel();

      expect(MockChatOpenAI).toHaveBeenCalledTimes(1);
      const callArg = MockChatOpenAI.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArg.apiKey).toBe("sk-test-openai");
      // No custom baseURL for plain OpenAI
      expect(
        (callArg.configuration as Record<string, unknown> | undefined)?.baseURL,
      ).toBeUndefined();
    });

    it("injects baseURL into configuration when OPENAI_BASE_URL is set", () => {
      process.env.OPENAI_API_KEY = "sk-test-openai";
      process.env.OPENAI_BASE_URL = "https://custom.api.example.com/v1";

      createLangChainChatModel();

      const callArg = MockChatOpenAI.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect((callArg.configuration as Record<string, unknown>).baseURL).toBe(
        "https://custom.api.example.com/v1",
      );
    });

    it("falls back to GEMINI_API_KEY with Gemini base URL when OPENAI_API_KEY is absent", () => {
      process.env.GEMINI_API_KEY = "gemini-key-abc";

      createLangChainChatModel();

      const callArg = MockChatOpenAI.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArg.apiKey).toBe("gemini-key-abc");
      expect((callArg.configuration as Record<string, unknown>).baseURL).toBe(
        "https://generativelanguage.googleapis.com/v1beta/openai",
      );
    });

    it("returns a ChatOpenAI instance", () => {
      process.env.OPENAI_API_KEY = "sk-test";

      const model = createLangChainChatModel();

      expect(MockChatOpenAI).toHaveBeenCalledTimes(1);
      expect(model).toBeDefined();
    });

    it("allows overriding the model name", () => {
      process.env.OPENAI_API_KEY = "sk-test";

      createLangChainChatModel({ model: "gpt-4o" });

      const callArg = MockChatOpenAI.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArg.model).toBe("gpt-4o");
    });

    it("passes through a custom timeout when provided", () => {
      process.env.OPENAI_API_KEY = "sk-test";

      createLangChainChatModel({ timeoutMs: 600_000 });

      const callArg = MockChatOpenAI.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArg.timeout).toBe(600_000);
    });

    it("registers Langfuse callbacks when Langfuse credentials are configured", () => {
      process.env.OPENAI_API_KEY = "sk-test";
      process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-test";
      process.env.LANGFUSE_SECRET_KEY = "sk-lf-test";
      process.env.LANGFUSE_RELEASE = "release-123";

      createLangChainChatModel({
        tracing: {
          traceName: "chat-api",
          userId: "user-1",
          sessionId: "session-1",
          tags: ["chat-api"],
          metadata: { feature: "chat" },
        },
      });

      expect(MockLangfuseCallbackHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          traceName: "chat-api",
          userId: "user-1",
          sessionId: "session-1",
          version: "release-123",
          tags: expect.arrayContaining(["langchain", "openai", "chat-api"]),
          traceMetadata: expect.objectContaining({
            feature: "chat",
            providerId: "openai",
            model: "gpt-5.2-mini",
          }),
        }),
      );

      const callArg = MockChatOpenAI.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArg.callbacks).toEqual([
        expect.objectContaining({ _type: "LangfuseCallbackHandler" }),
      ]);
    });
  });

  describe("createLangChainChatModelForUseCase", () => {
    it("uses the policy-selected model instead of OPEN_ROUTER_MODEL", () => {
      process.env.OPEN_ROUTER_API_KEY = "or-key";
      process.env.OPEN_ROUTER_MODEL = "google/gemini-2.5-flash";

      createLangChainChatModelForUseCase({
        useCase: "interview-core",
        userTier: "premium",
      });

      const callArg = MockChatOpenAI.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArg.model).toBe("openai/gpt-5.4");
      expect(callArg.apiKey).toBe("or-key");
      expect((callArg.configuration as Record<string, unknown>).baseURL).toBe(
        "https://openrouter.ai/api/v1",
      );
    });
  });

  describe("createLangChainEmbeddings", () => {
    it("uses OpenRouter embeddings config when OPEN_ROUTER_API_KEY is set", () => {
      process.env.OPEN_ROUTER_API_KEY = "or-key";
      process.env.OPEN_ROUTER_EMBEDDING_MODEL = "openai/text-embedding-3-large";

      createLangChainEmbeddings();

      const callArg = MockOpenAIEmbeddings.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArg.model).toBe("openai/text-embedding-3-large");
      expect(callArg.openAIApiKey).toBe("or-key");
      expect((callArg.configuration as Record<string, unknown>).baseURL).toBe(
        "https://openrouter.ai/api/v1",
      );
    });

    it("returns an OpenAIEmbeddings instance", () => {
      process.env.OPENAI_API_KEY = "sk-test";

      const embeddings = createLangChainEmbeddings();

      expect(MockOpenAIEmbeddings).toHaveBeenCalledTimes(1);
      expect(embeddings).toBeDefined();
    });

    it("allows overriding the embeddings model name", () => {
      process.env.OPENAI_API_KEY = "sk-test";

      createLangChainEmbeddings({ model: "text-embedding-3-large" });

      const callArg = MockOpenAIEmbeddings.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArg.model).toBe("text-embedding-3-large");
    });

    it("uses Gemini credentials when GEMINI_API_KEY is set", () => {
      process.env.GEMINI_API_KEY = "gemini-key";

      createLangChainEmbeddings();

      const callArg = MockOpenAIEmbeddings.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArg.openAIApiKey).toBe("gemini-key");
      expect((callArg.configuration as Record<string, unknown>).baseURL).toBe(
        "https://generativelanguage.googleapis.com/v1beta/openai",
      );
    });
  });

  describe("createLangChainEmbeddingsForUseCase", () => {
    it("uses the dedicated embedding route for rag-embedding", () => {
      process.env.OPENAI_API_KEY = "sk-test";

      createLangChainEmbeddingsForUseCase({
        useCase: "rag-embedding",
      });

      const callArg = MockOpenAIEmbeddings.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArg.model).toBe("text-embedding-3-large");
      expect(callArg.openAIApiKey).toBe("sk-test");
    });
  });
});

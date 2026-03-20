import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { MockChatOpenAI, MockOpenAIEmbeddings } = vi.hoisted(() => {
  const MockChatOpenAI = vi.fn(function (this: unknown, opts: unknown) {
    return { _type: "ChatOpenAI", opts };
  });
  const MockOpenAIEmbeddings = vi.fn(function (this: unknown, opts: unknown) {
    return { _type: "OpenAIEmbeddings", opts };
  });
  return { MockChatOpenAI, MockOpenAIEmbeddings };
});

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: MockChatOpenAI,
  OpenAIEmbeddings: MockOpenAIEmbeddings,
}));

import {
  createLangChainChatModel,
  createLangChainEmbeddings,
} from "./langchain-factories";

describe("langchain-factories", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_MODEL;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_EMBEDDING_MODEL;
  });

  afterEach(() => {
    for (const key of [
      "OPENAI_API_KEY",
      "OPENAI_BASE_URL",
      "OPENAI_MODEL",
      "GEMINI_API_KEY",
      "GEMINI_MODEL",
      "GEMINI_EMBEDDING_MODEL",
    ]) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  describe("createLangChainChatModel", () => {
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
  });

  describe("createLangChainEmbeddings", () => {
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
});

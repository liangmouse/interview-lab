import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_OPENROUTER_EMBEDDING_MODEL,
  OPENROUTER_BASE_URL,
  resolveDefaultEmbeddingModel,
  resolveOpenAICompatibleConfig,
  validateLlmConfig,
} from "./openai-compatible-config";

describe("runtime/openai-compatible-config", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
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
    ]) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("prioritizes OpenRouter config and exposes default headers", () => {
    process.env.OPEN_ROUTER_API_KEY = "or-key";
    process.env.OPEN_ROUTER_HTTP_REFERER = "https://example.com";
    process.env.OPEN_ROUTER_TITLE = "InterviewClaw";

    const config = resolveOpenAICompatibleConfig();

    expect(config).toMatchObject({
      providerId: "openrouter",
      apiKey: "or-key",
      baseURL: OPENROUTER_BASE_URL,
      model: "google/gemini-2.5-flash",
      headers: {
        "HTTP-Referer": "https://example.com",
        "X-Title": "InterviewClaw",
      },
    });
  });

  it("supports the OPEN_ROUTER_API alias", () => {
    process.env.OPEN_ROUTER_API = "or-alias-key";

    const config = resolveOpenAICompatibleConfig();

    expect(config.providerId).toBe("openrouter");
    expect(config.apiKey).toBe("or-alias-key");
  });

  it("falls back to OpenAI, then Gemini, when OpenRouter is absent", () => {
    process.env.OPENAI_API_KEY = "openai-key";
    expect(resolveOpenAICompatibleConfig().providerId).toBe("openai");

    delete process.env.OPENAI_API_KEY;
    process.env.GEMINI_API_KEY = "gemini-key";
    expect(resolveOpenAICompatibleConfig().providerId).toBe("gemini");
  });

  it("resolves the default embedding model from OpenRouter first", () => {
    process.env.OPEN_ROUTER_API_KEY = "or-key";

    expect(resolveDefaultEmbeddingModel()).toEqual({
      providerId: "openrouter",
      model: DEFAULT_OPENROUTER_EMBEDDING_MODEL,
    });
  });

  it("treats OpenRouter config as a valid LLM provider", () => {
    process.env.OPEN_ROUTER_API_KEY = "or-key-long-enough";

    expect(validateLlmConfig()).toEqual({ isValid: true });
  });
});

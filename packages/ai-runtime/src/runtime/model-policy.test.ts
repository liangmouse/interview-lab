import { describe, expect, it } from "vitest";
import { resolveAiModelRoute } from "./model-policy";

describe("runtime/model-policy", () => {
  it("uses premium interview policy on OpenRouter when available", () => {
    const route = resolveAiModelRoute({
      useCase: "interview-core",
      userTier: "premium",
      env: {
        OPEN_ROUTER_API_KEY: "or-key",
      } as NodeJS.ProcessEnv,
    });

    expect(route.providerId).toBe("openrouter");
    expect(route.model).toBe("openai/gpt-5.4");
  });

  it("falls back to OpenAI when OpenRouter is not configured", () => {
    const route = resolveAiModelRoute({
      useCase: "resume-parse",
      userTier: "premium",
      env: {
        OPENAI_API_KEY: "openai-key",
      } as NodeJS.ProcessEnv,
    });

    expect(route.providerId).toBe("openai");
    expect(route.model).toBe("gpt-5.4-mini");
  });

  it("uses the free-tier question prediction route when available", () => {
    const route = resolveAiModelRoute({
      useCase: "question-predict",
      userTier: "free",
      env: {
        OPEN_ROUTER_API_KEY: "or-key",
      } as NodeJS.ProcessEnv,
    });

    expect(route.providerId).toBe("openrouter");
    expect(route.model).toBe("deepseek/deepseek-v3.2");
  });

  it("resolves embeddings through the dedicated embedding route", () => {
    const route = resolveAiModelRoute({
      useCase: "rag-embedding",
      env: {
        OPENAI_API_KEY: "openai-key",
      } as NodeJS.ProcessEnv,
    });

    expect(route.providerId).toBe("openai");
    expect(route.model).toBe("text-embedding-3-small");
  });
});

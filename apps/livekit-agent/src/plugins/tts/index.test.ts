import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTtsFromConfig,
  DEFAULT_TTS_BASE_URL,
  DEFAULT_TTS_MODEL,
  resolveTtsConfig,
} from "./index";

describe("plugins/tts.resolveTtsConfig", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    for (const key of [
      "TTS_MODEL",
      "TTS_API_KEY",
      "TTS_BASE_URL",
      "TTS_OPENROUTER_HTTP_REFERER",
      "TTS_OPENROUTER_TITLE",
      "OPEN_ROUTER_API_KEY",
      "OPEN_ROUTER_API",
      "OPEN_ROUTER_HTTP_REFERER",
      "OPEN_ROUTER_TITLE",
    ]) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("defaults to OpenRouter config and falls back to OPEN_ROUTER_* env vars", () => {
    process.env.OPEN_ROUTER_API_KEY = "openrouter-key";
    process.env.OPEN_ROUTER_HTTP_REFERER = "https://example.com";
    process.env.OPEN_ROUTER_TITLE = "InterviewClaw";

    const config = resolveTtsConfig("zh-CN");

    expect(config).toMatchObject({
      providerId: "openrouter",
      apiKey: "openrouter-key",
      model: DEFAULT_TTS_MODEL,
      baseURL: DEFAULT_TTS_BASE_URL,
      voice: "alloy",
      sampleRate: 24000,
      audioFormat: "pcm16",
      headers: {
        "HTTP-Referer": "https://example.com",
        "X-Title": "InterviewClaw",
      },
    });
  });

  it("supports runtime overrides for OpenRouter", () => {
    process.env.OPEN_ROUTER_API_KEY = "openrouter-key";
    process.env.TTS_MODEL = "openai/gpt-audio";
    process.env.TTS_BASE_URL = "https://custom.example.com/v1";
    process.env.TTS_OPENROUTER_HTTP_REFERER = "https://tts.example.com";
    process.env.TTS_OPENROUTER_TITLE = "TTS";

    const config = resolveTtsConfig("en-US", {
      voice: "ash",
      audioFormat: "wav",
      sampleRate: 44100,
    });

    expect(config).toMatchObject({
      providerId: "openrouter",
      model: "openai/gpt-audio",
      baseURL: "https://custom.example.com/v1",
      voice: "ash",
      audioFormat: "wav",
      sampleRate: 44100,
      headers: {
        "HTTP-Referer": "https://tts.example.com",
        "X-Title": "TTS",
      },
    });
  });

  it("creates the provider instance resolved from config", () => {
    process.env.OPEN_ROUTER_API_KEY = "openrouter-key";
    const config = resolveTtsConfig("en-US");

    const tts = createTtsFromConfig(config);

    expect(tts.label).toBe("openrouter.chat-audio.TTS");
  });
});

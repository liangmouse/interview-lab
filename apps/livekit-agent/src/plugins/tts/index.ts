import type { tts } from "@livekit/agents";
import {
  createOpenRouterChatAudioTTS,
  OpenRouterChatAudioTTS,
} from "./openrouter-chat-audio-tts";
import type {
  ResolvedTtsConfig,
  TtsAudioFormat,
  TtsProviderFactory,
  TtsProviderId,
  TtsRuntimeOverrides,
} from "./types";

export type {
  ResolvedTtsConfig,
  TtsAudioFormat,
  TtsProviderFactory,
  TtsProviderId,
  TtsRuntimeOverrides,
} from "./types";
export { OpenRouterChatAudioTTS, createOpenRouterChatAudioTTS };

export const DEFAULT_TTS_PROVIDER: TtsProviderId = "openrouter";
export const DEFAULT_TTS_MODEL = "openai/gpt-audio-mini";
export const DEFAULT_TTS_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_TTS_SAMPLE_RATE = 24000;
export const DEFAULT_TTS_AUDIO_FORMAT: TtsAudioFormat = "pcm";
export const DEFAULT_TTS_VOICE = "alloy";

const providerFactories: Record<TtsProviderId, TtsProviderFactory> = {
  openrouter: {
    id: "openrouter",
    isConfigured(env) {
      return !!(
        trimString(env.TTS_API_KEY) ||
        trimString(env.OPEN_ROUTER_API_KEY) ||
        trimString(env.OPEN_ROUTER_API)
      );
    },
    create(config) {
      return createOpenRouterChatAudioTTS(config);
    },
  },
};

export function resolveTtsConfig(
  locale?: string,
  overrides?: TtsRuntimeOverrides,
): ResolvedTtsConfig {
  const env = process.env;
  const providerId: TtsProviderId = "openrouter";
  const sampleRate = resolveSampleRate(overrides?.sampleRate);

  const apiKey =
    trimString(env.TTS_API_KEY) ||
    trimString(env.OPEN_ROUTER_API_KEY) ||
    trimString(env.OPEN_ROUTER_API);
  if (!apiKey) {
    throw new Error(
      "[TTS Config] Missing required env: TTS_API_KEY or OPEN_ROUTER_API_KEY/OPEN_ROUTER_API",
    );
  }

  return {
    providerId,
    apiKey,
    model: trimString(env.TTS_MODEL) || DEFAULT_TTS_MODEL,
    baseURL: trimString(env.TTS_BASE_URL) || DEFAULT_TTS_BASE_URL,
    voice: resolveVoice(locale, overrides, {
      english: DEFAULT_TTS_VOICE,
      nonEnglish: DEFAULT_TTS_VOICE,
    }),
    sampleRate,
    audioFormat: resolveAudioFormat(overrides?.audioFormat),
    headers: resolveOpenRouterHeaders(env),
  };
}

export function createTtsFromConfig(config: ResolvedTtsConfig): tts.TTS {
  return providerFactories[config.providerId].create(config);
}

export function isTtsProviderConfigured(
  providerId: TtsProviderId,
  env: NodeJS.ProcessEnv = process.env,
) {
  return providerFactories[providerId].isConfigured(env);
}

function resolveAudioFormat(value: TtsAudioFormat | undefined): TtsAudioFormat {
  return value === "wav" ? "wav" : DEFAULT_TTS_AUDIO_FORMAT;
}

function resolveSampleRate(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_TTS_SAMPLE_RATE;
}

function resolveVoice(
  locale: string | undefined,
  overrides: TtsRuntimeOverrides | undefined,
  defaults: { english: string; nonEnglish: string },
) {
  const isEnglish = locale?.toLowerCase().startsWith("en") ?? false;
  return (
    overrides?.voice || (isEnglish ? defaults.english : defaults.nonEnglish)
  );
}

function resolveOpenRouterHeaders(env: NodeJS.ProcessEnv) {
  const referer =
    trimString(env.TTS_OPENROUTER_HTTP_REFERER) ||
    trimString(env.OPEN_ROUTER_HTTP_REFERER);
  const title =
    trimString(env.TTS_OPENROUTER_TITLE) || trimString(env.OPEN_ROUTER_TITLE);
  const headers: Record<string, string> = {};

  if (referer) {
    headers["HTTP-Referer"] = referer;
  }

  if (title) {
    headers["X-Title"] = title;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

function trimString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

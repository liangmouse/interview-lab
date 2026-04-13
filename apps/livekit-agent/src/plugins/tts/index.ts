import type { tts } from "@livekit/agents";
import { createVolcengineTTS, VolcengineTTS } from "./volcengine-tts";
import type {
  ResolvedTtsConfig,
  TtsProviderFactory,
  TtsProviderId,
  TtsRuntimeOverrides,
} from "./types";

export type {
  ResolvedTtsConfig,
  TtsProviderFactory,
  TtsProviderId,
  TtsRuntimeOverrides,
} from "./types";
export { VolcengineTTS, createVolcengineTTS };

export const DEFAULT_TTS_SAMPLE_RATE = 24000;
export const DEFAULT_TTS_VOICE = "BV700_streaming";
export const DEFAULT_TTS_CLUSTER = "volcano_tts";

export function resolveTtsConfig(
  _locale?: string,
  overrides?: TtsRuntimeOverrides,
): ResolvedTtsConfig {
  const env = process.env;
  const sampleRate = resolveSampleRate(overrides?.sampleRate);

  const appId = trimString(env.VOLCENGINE_TTS_APP_ID);
  if (!appId) {
    throw new Error("[TTS Config] Missing required env: VOLCENGINE_TTS_APP_ID");
  }

  const token = trimString(env.VOLCENGINE_TTS_ACCESS_TOKEN);
  if (!token) {
    throw new Error(
      "[TTS Config] Missing required env: VOLCENGINE_TTS_ACCESS_TOKEN",
    );
  }

  return {
    providerId: "volcengine",
    appId,
    apiKey: token,
    cluster: trimString(env.VOLCENGINE_TTS_CLUSTER) ?? DEFAULT_TTS_CLUSTER,
    voice: overrides?.voice ?? DEFAULT_TTS_VOICE,
    sampleRate,
  };
}

export function createTtsFromConfig(config: ResolvedTtsConfig): tts.TTS {
  return createVolcengineTTS(config);
}

export function isTtsProviderConfigured(
  _providerId: TtsProviderId,
  env: NodeJS.ProcessEnv = process.env,
) {
  return !!(
    trimString(env.VOLCENGINE_TTS_APP_ID) &&
    trimString(env.VOLCENGINE_TTS_ACCESS_TOKEN)
  );
}

function resolveSampleRate(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_TTS_SAMPLE_RATE;
}

function trimString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

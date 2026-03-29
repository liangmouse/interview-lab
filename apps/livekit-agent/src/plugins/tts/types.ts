import type { tts } from "@livekit/agents";

export type TtsProviderId = "openrouter";
export type TtsAudioFormat = "pcm" | "pcm16" | "wav";

export interface TtsRuntimeOverrides {
  voice?: string;
  sampleRate?: number;
  audioFormat?: TtsAudioFormat;
}

export interface ResolvedTtsConfig {
  providerId: TtsProviderId;
  apiKey: string;
  model: string;
  baseURL: string;
  voice: string;
  sampleRate: number;
  audioFormat: TtsAudioFormat;
  headers?: Record<string, string>;
}

export interface TtsProviderFactory {
  id: TtsProviderId;
  isConfigured(env: NodeJS.ProcessEnv): boolean;
  create(config: ResolvedTtsConfig): tts.TTS;
}

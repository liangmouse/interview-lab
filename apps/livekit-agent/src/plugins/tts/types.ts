import type { tts } from "@livekit/agents";

export type TtsProviderId = "volcengine";

export interface TtsRuntimeOverrides {
  voice?: string;
  sampleRate?: number;
}

export interface ResolvedTtsConfig {
  providerId: TtsProviderId;
  appId: string;
  apiKey: string; // volcengine access token
  cluster: string;
  voice: string;
  sampleRate: number;
}

export interface TtsProviderFactory {
  id: TtsProviderId;
  isConfigured(env: NodeJS.ProcessEnv): boolean;
  create(config: ResolvedTtsConfig): tts.TTS;
}

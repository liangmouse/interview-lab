import type { stt } from "@livekit/agents";

export type SttProviderId = "volcengine" | "deepgram";

export interface SttRuntimeOverrides {
  language?: string;
  keywords?: string[];
}

export interface ResolvedSttConfig {
  providerId: SttProviderId;
  language: string;
  keywords: string[];
}

export interface SttProviderFactory {
  id: SttProviderId;
  create(config: ResolvedSttConfig): stt.STT;
}

import { OpenAI } from "openai";

export type RuntimeProviderId = string;
export type RuntimeProviderApi = string;

export interface RuntimeProvider {
  id: RuntimeProviderId;
  api: RuntimeProviderApi;
  baseURL: string;
  createClientFetch(): typeof globalThis.fetch;
  createOpenAIClient(apiKey?: string): OpenAI;
}

export type ProviderRegistry = Map<RuntimeProviderId, RuntimeProvider>;

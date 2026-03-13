import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as openai from "@livekit/agents-plugin-openai";
import {
  type AuthProfileStore,
  buildProviderRegistry,
  createAuthProfileStore,
  createOpenAICodexRegistryEntry,
  createOpenAICodexAuthProvider,
  createOpenAIRegistryEntry,
  resolveModelRoute,
} from "@interviewclaw/ai-runtime";
import {
  createUserScopedSupabaseAuthProfileStore,
  getSupabaseAdminClient,
} from "@interviewclaw/data-access";
import { GeminiTTS } from "../plugins/gemini-tts-plugin";

export const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai";
export const GEMINI_NATIVE_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
export const DEFAULT_GEMINI_TEMPERATURE = 0.4;

// 默认使用 Deepgram 的高精度通用模型（多语言）
export const DEFAULT_DEEPGRAM_MODEL = "nova-3-general";
export const DEFAULT_DEEPGRAM_LANGUAGE = "zh";
export const DEFAULT_DEEPGRAM_SMART_FORMAT = true;
export const DEEPGRAM_KEYTERM_LIMIT = 20;

export const DEFAULT_GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
export const DEFAULT_GEMINI_TTS_VOICE = "Kore";
export const ROUTED_OPENAI_RUNTIME_TOKEN = "openai-codex-runtime-token";

type AgentRuntimeProviderConfig = {
  providerId: string;
  requiresUserId?: boolean;
  useUserScopedProfileStore?: boolean;
  createRegistryEntry: (input: {
    profileStore: AuthProfileStore;
  }) => ReturnType<typeof createOpenAIRegistryEntry>;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  const resolved = typeof v === "string" ? v.trim() : "";
  if (!resolved) {
    throw new Error(`[Agent Config] Missing required env: ${name}`);
  }
  return resolved;
}

export function getGeminiApiKey(): string {
  return requireEnv("GEMINI_API_KEY");
}

export function getDeepgramApiKey(): string {
  return requireEnv("DEEPGRAM_API_KEY");
}

export function getGeminiModel(): string {
  const v = process.env.GEMINI_MODEL;
  const resolved = typeof v === "string" ? v.trim() : "";
  return resolved || DEFAULT_GEMINI_MODEL;
}

export function getDeepgramModel(): string {
  const v = process.env.DEEPGRAM_MODEL;
  const resolved = typeof v === "string" ? v.trim() : "";
  return resolved || DEFAULT_DEEPGRAM_MODEL;
}

export function getDeepgramLanguage(): string {
  const v = process.env.DEEPGRAM_LANGUAGE;
  const resolved = typeof v === "string" ? v.trim() : "";
  if (!resolved) return DEFAULT_DEEPGRAM_LANGUAGE;

  const normalized = resolved.toLowerCase();
  if (normalized === "en-us" || normalized === "en") return "en-US";
  if (normalized === "zh-cn" || normalized === "zh_cn" || normalized === "zh")
    return "zh";
  return resolved;
}

function resolveDeepgramModel(language: string): string {
  const model = getDeepgramModel();
  const lang = language.toLowerCase();
  const isEnglish = lang === "en-us" || lang === "en";

  // nova-3 系列目前仅支持英文，非英文时提前回退，避免 400
  if (!isEnglish && model.startsWith("nova-3")) {
    return "nova-2-general";
  }

  return model;
}

export function createDeepgramSTT(keyterm: string[], language?: string) {
  const cleanedKeyterms = Array.isArray(keyterm)
    ? keyterm
        .filter((k) => typeof k === "string" && k.trim())
        .slice(0, DEEPGRAM_KEYTERM_LIMIT)
    : [];
  const resolvedLanguage = language || getDeepgramLanguage();
  const resolvedModel = resolveDeepgramModel(resolvedLanguage);
  const normalizedLanguage = resolvedLanguage.toLowerCase();
  const isEnglish =
    normalizedLanguage === "en" || normalizedLanguage === "en-us";

  // Deepgram 对非英文场景的 keyword boost 支持有限，且 SDK 会对 keywords 进行双重编码导致 400，
  // 因此仅保留 keyterm 作为提示词，keywords 置空。
  const keywords: [string, number][] = [];

  // keyterm 在非英文场景下容易触发 Deepgram 400（尤其包含中文词汇时），仅在英文启用
  const resolvedKeyterms = isEnglish ? cleanedKeyterms : [];

  const sttInstance = new deepgram.STT({
    apiKey: getDeepgramApiKey(),
    // 使用 as any 绕过类型检查，最新模型在类型定义中可能缺失
    model: resolvedModel as any,
    language: resolvedLanguage,
    smartFormat: DEFAULT_DEEPGRAM_SMART_FORMAT,
    keywords,
    keyterm: resolvedKeyterms,
  });

  return sttInstance;
}

export function createGeminiLLM() {
  return new openai.LLM({
    apiKey: getGeminiApiKey(),
    model: getGeminiModel(),
    baseURL: GEMINI_BASE_URL,
    temperature: DEFAULT_GEMINI_TEMPERATURE,
  });
}

function getAgentLlmModel(): string | null {
  const value = process.env.AGENT_LLM_MODEL?.trim();
  return value || null;
}

function getAgentRuntimeProviderConfigs(): AgentRuntimeProviderConfig[] {
  return [
    {
      providerId: "openai",
      createRegistryEntry: () => createOpenAIRegistryEntry(),
    },
    {
      providerId: "openai-codex",
      requiresUserId: true,
      useUserScopedProfileStore: true,
      createRegistryEntry: ({ profileStore }) =>
        createOpenAICodexRegistryEntry({
          profileStore,
          authProvider: createOpenAICodexAuthProvider({
            env: process.env,
            profileStore,
          }),
        }),
    },
  ];
}

export async function createConfiguredLLM(userId?: string) {
  const configuredModel = getAgentLlmModel();
  if (!configuredModel) {
    return createGeminiLLM();
  }

  const providerId = configuredModel.split("/", 1)[0];
  const providerConfigs = getAgentRuntimeProviderConfigs();
  const providerConfig = providerConfigs.find(
    (item) => item.providerId === providerId,
  );

  if (!providerConfig) {
    throw new Error(`Unsupported AGENT_LLM_MODEL provider: ${providerId}`);
  }

  if (providerConfig.requiresUserId && !userId) {
    throw new Error(`${providerId} models require a userId`);
  }

  const profileStore = providerConfig.useUserScopedProfileStore
    ? createUserScopedSupabaseAuthProfileStore({
        userId: userId as string,
        supabase: getSupabaseAdminClient() as any,
      })
    : createAuthProfileStore();
  const registry = await buildProviderRegistry({
    env: process.env,
    entries: providerConfigs.map((item) =>
      item.createRegistryEntry({
        profileStore,
      }),
    ),
  });
  const route = await resolveModelRoute(configuredModel, registry);

  return new openai.LLM({
    apiKey: ROUTED_OPENAI_RUNTIME_TOKEN,
    baseURL: route.provider.baseURL,
    model: route.model,
    temperature: DEFAULT_GEMINI_TEMPERATURE,
    // The LiveKit OpenAI plugin pins its own OpenAI client version, so we keep
    // the shared runtime client behind a narrow compatibility cast here.
    client: route.provider.createOpenAIClient(
      ROUTED_OPENAI_RUNTIME_TOKEN,
    ) as any,
  });
}

export function createGeminiTTS(language?: string) {
  const isEnglish = language?.toLowerCase().startsWith("en");
  const voice = isEnglish ? "Zephyr" : DEFAULT_GEMINI_TTS_VOICE;

  return new GeminiTTS({
    apiKey: getGeminiApiKey(),
    model: process.env.GEMINI_TTS_MODEL || DEFAULT_GEMINI_TTS_MODEL,
    voiceName: voice,
    baseUrl: GEMINI_NATIVE_BASE_URL,
    sampleRate: 24000,
  });
}

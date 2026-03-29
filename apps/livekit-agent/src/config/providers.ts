import * as openai from "@livekit/agents-plugin-openai";
import {
  type AiUseCase,
  type AiUserTier,
  type AuthProfileStore,
  type LangfuseTracingContext,
  type OpenAICompatibleConfig,
  buildProviderRegistry,
  createAuthProfileStore,
  createOpenAIProvider,
  createOpenAICodexRegistryEntry,
  createOpenAICodexAuthProvider,
  createOpenAIRegistryEntry,
  createOpenRouterRegistryEntry,
  mergeLangfuseTracingContext,
  observeOpenAIClient,
  resolveAiModelRoute,
  resolveModelRoute,
  resolveOpenAICompatibleProviderConfig,
} from "@interviewclaw/ai-runtime";
import {
  createUserScopedSupabaseAuthProfileStore,
  getSupabaseAdminClient,
} from "@interviewclaw/data-access";
import {
  createTtsFromConfig,
  resolveTtsConfig,
  type TtsRuntimeOverrides,
} from "../plugins/tts";
import { createSTT, type SttProviderId } from "../plugins/stt";
import { InterviewStage } from "../runtime/fsm/types";

export const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai";
export const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
export const DEFAULT_GEMINI_TEMPERATURE = 0.4;

// STT Provider 选择：在此切换默认 Provider（"volcengine" | "deepgram"）
export const DEFAULT_STT_PROVIDER: SttProviderId = "volcengine";

export const ROUTED_OPENAI_RUNTIME_TOKEN = "openai-codex-runtime-token";

export interface CreateConfiguredLLMOptions {
  useCase?: AiUseCase;
  userTier?: AiUserTier;
  model?: string;
}

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

export function getGeminiModel(): string {
  const v = process.env.GEMINI_MODEL;
  const resolved = typeof v === "string" ? v.trim() : "";
  return resolved || DEFAULT_GEMINI_MODEL;
}

/**
 * 创建 STT 实例，通过 DEFAULT_STT_PROVIDER 常量选择 Provider。
 *
 * @param keywords  热词/关键词列表（技术术语、人名等）
 * @param language  语言代码，默认 "zh"
 */
export function createConfiguredSTT(
  keywords: string[] = [],
  language?: string,
) {
  return createSTT(DEFAULT_STT_PROVIDER, keywords, language);
}

export function createDefaultLLM(
  tracing?: LangfuseTracingContext,
  options?: CreateConfiguredLLMOptions,
) {
  const route = resolveAiModelRoute({
    useCase: options?.useCase ?? "interview-core",
    userTier: options?.userTier,
  });
  const config = resolveOpenAICompatibleProviderConfig({
    providerId: route.providerId,
    defaultModel: route.model,
  });
  const client = createDefaultLlmClient(config, tracing);
  return new openai.LLM({
    apiKey: config.apiKey,
    model: route.model,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    ...(client ? { client } : {}),
    temperature: route.temperature ?? DEFAULT_GEMINI_TEMPERATURE,
  });
}

function createDefaultLlmClient(
  config: OpenAICompatibleConfig,
  tracing?: LangfuseTracingContext,
) {
  const provider = createOpenAIProvider({
    id: config.providerId,
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    ...(config.headers ? { headers: config.headers } : {}),
  });

  return observeOpenAIClient(
    provider.createOpenAIClient(config.apiKey) as any,
    mergeLangfuseTracingContext(
      {
        traceName: "livekit-agent-llm",
        tags: ["livekit-agent", config.providerId],
        metadata: {
          providerId: config.providerId,
          model: config.model,
        },
      },
      tracing,
    ),
  ) as any;
}

function getAgentLlmModel(input?: string): string | null {
  const value = input?.trim() || process.env.AGENT_LLM_MODEL?.trim();
  return value || null;
}

function getAgentRuntimeProviderConfigs(): AgentRuntimeProviderConfig[] {
  return [
    {
      providerId: "openrouter",
      createRegistryEntry: () => createOpenRouterRegistryEntry(),
    },
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

export async function createConfiguredLLM(
  userId?: string,
  tracing?: LangfuseTracingContext,
  options?: CreateConfiguredLLMOptions,
) {
  const mergedTracing = mergeLangfuseTracingContext({ userId }, tracing);
  const configuredModel = getAgentLlmModel(options?.model);
  if (!configuredModel) {
    return createDefaultLLM(mergedTracing, options);
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
  const observedClient = observeOpenAIClient(
    route.provider.createOpenAIClient(ROUTED_OPENAI_RUNTIME_TOKEN) as any,
    mergeLangfuseTracingContext(
      {
        traceName: "livekit-agent-routed-llm",
        tags: ["livekit-agent", providerId],
        metadata: {
          providerId,
          model: route.model,
        },
      },
      mergedTracing,
    ),
  );

  return new openai.LLM({
    apiKey: ROUTED_OPENAI_RUNTIME_TOKEN,
    baseURL: route.provider.baseURL,
    model: route.model,
    temperature: DEFAULT_GEMINI_TEMPERATURE,
    // The LiveKit OpenAI plugin pins its own OpenAI client version, so we keep
    // the shared runtime client behind a narrow compatibility cast here.
    client: observedClient as any,
  });
}

// ─── 功能3: 按面试阶段动态切换 LLM 模型 ───────────────────────────────────────
//
// 模型映射优先从环境变量读取，格式：STAGE_LLM_<STAGE>=<provider>/<model>
// 例如：
//   STAGE_LLM_INTRO=openrouter/google/gemini-3.1-flash-lite-preview
//   STAGE_LLM_MAIN_TECHNICAL=openrouter/google/gemini-3.1-pro-preview
//   STAGE_LLM_SOFT_SKILLS=openrouter/anthropic/claude-haiku-4.5
//   STAGE_LLM_CLOSING=openrouter/deepseek/deepseek-v3.2
//
// 若未配置则沿用各阶段的内置默认值。

/** 各阶段的内置默认模型（openai-compatible 格式，与 AGENT_LLM_MODEL 相同风格）
 *
 * 选型依据（2026-03-26 OpenRouter 验证）：
 *   INTRO        — gemini-3.1-flash-lite-preview：最低延迟，开场对话无需强推理，$0.25/$1.50 per M
 *   MAIN_TECHNICAL — gemini-3.1-pro-preview：Intelligence Index 第一，强制深度推理，$2/$12 per M
 *   SOFT_SKILLS  — claude-haiku-4.5：Claude 系列自然对话/共情表达最优，$1/$5 per M
 *   CLOSING      — deepseek-v3.2：长文总结极强，$0.26/$0.38 per M（本阶段输出 token 最多）
 */
const STAGE_DEFAULT_MODELS: Record<InterviewStage, string> = {
  // INTRO: 最快响应，开场自我介绍轻量场景
  [InterviewStage.INTRO]: "openrouter/google/gemini-3.1-flash-lite-preview",
  // MAIN_TECHNICAL: 全球智能排行第一，强推理处理复杂技术题
  [InterviewStage.MAIN_TECHNICAL]: "openrouter/google/gemini-3.1-pro-preview",
  // SOFT_SKILLS: Sonnet 4.6 理解深度和追问灵活度远超 Haiku，行为面试需要读懂潜台词
  [InterviewStage.SOFT_SKILLS]: "openrouter/anthropic/claude-sonnet-4.6",
  // CLOSING: DeepSeek V3.2 长文归纳极强，output 成本最低
  [InterviewStage.CLOSING]: "openrouter/deepseek/deepseek-v3.2",
};

/** 环境变量名称映射 */
const STAGE_ENV_KEYS: Record<InterviewStage, string> = {
  [InterviewStage.INTRO]: "STAGE_LLM_INTRO",
  [InterviewStage.MAIN_TECHNICAL]: "STAGE_LLM_MAIN_TECHNICAL",
  [InterviewStage.SOFT_SKILLS]: "STAGE_LLM_SOFT_SKILLS",
  [InterviewStage.CLOSING]: "STAGE_LLM_CLOSING",
};

/**
 * 获取指定面试阶段应使用的模型标识符。
 * 优先读取环境变量，其次使用内置默认值。
 */
export function getStageModel(stage: InterviewStage): string {
  const envKey = STAGE_ENV_KEYS[stage];
  const envValue = process.env[envKey]?.trim();
  if (envValue) {
    return envValue;
  }
  return STAGE_DEFAULT_MODELS[stage];
}

/**
 * 为指定面试阶段创建对应的 LLM 实例。
 * 当阶段模型与全局 AGENT_LLM_MODEL 相同（或未配置全局模型）时，
 * 优先使用阶段专属模型。
 *
 * @param stage  当前面试阶段
 * @param userId 用户 ID（部分 provider 需要）
 */
export async function createLLMForStage(
  stage: InterviewStage,
  userId?: string,
): Promise<openai.LLM> {
  const stageModel = getStageModel(stage);
  console.log(`[LLM] 阶段 ${stage} 使用模型: ${stageModel}`);

  const providerId = stageModel.split("/", 1)[0];
  const providerConfigs = getAgentRuntimeProviderConfigs();
  const providerConfig = providerConfigs.find(
    (item) => item.providerId === providerId,
  );

  // 若 provider 不在注册表中（例如直接写 gemini/xxx），回退到默认 LLM
  if (!providerConfig) {
    console.warn(
      `[LLM] 阶段 ${stage} 的 provider "${providerId}" 未在注册表中，回退到默认 LLM`,
    );
    return createDefaultLLM();
  }

  if (providerConfig.requiresUserId && !userId) {
    console.warn(
      `[LLM] 阶段 ${stage} 的 provider "${providerId}" 需要 userId，回退到默认 LLM`,
    );
    return createDefaultLLM();
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
      item.createRegistryEntry({ profileStore }),
    ),
  });

  const route = await resolveModelRoute(stageModel, registry);

  return new openai.LLM({
    apiKey: ROUTED_OPENAI_RUNTIME_TOKEN,
    baseURL: route.provider.baseURL,
    model: route.model,
    temperature: DEFAULT_GEMINI_TEMPERATURE,
    client: route.provider.createOpenAIClient(
      ROUTED_OPENAI_RUNTIME_TOKEN,
    ) as any,
  });
}
// ─────────────────────────────────────────────────────────────────────────────

export { resolveTtsConfig } from "../plugins/tts";

export function createConfiguredTTS(
  locale?: string,
  overrides?: TtsRuntimeOverrides,
) {
  return createTtsFromConfig(resolveTtsConfig(locale, overrides));
}

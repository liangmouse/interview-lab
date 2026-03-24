import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import {
  resolveDefaultEmbeddingModel,
  resolveOpenAICompatibleConfig,
  resolveOpenAICompatibleProviderConfig,
} from "./openai-compatible-config";
import {
  resolveAiModelRoute,
  type AiUseCase,
  type AiUserTier,
} from "./model-policy";
import {
  createLangfuseLangChainCallbacks,
  mergeLangfuseTracingContext,
  type LangfuseTracingContext,
} from "./langfuse";

export interface CreateLangChainChatModelOptions {
  /** Override the default model resolved from env */
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  tracing?: LangfuseTracingContext;
}

export interface CreateLangChainChatModelForUseCaseOptions
  extends CreateLangChainChatModelOptions {
  useCase: AiUseCase;
  userTier?: AiUserTier;
}

function createChatModelFromConfig(
  config: ReturnType<typeof resolveOpenAICompatibleConfig>,
  options?: CreateLangChainChatModelOptions,
) {
  const modelName = options?.model ?? config.model;
  const callbacks = createLangfuseLangChainCallbacks(
    mergeLangfuseTracingContext(
      {
        tags: ["langchain", config.providerId],
        metadata: {
          providerId: config.providerId,
          model: modelName,
        },
      },
      options?.tracing,
    ),
  );

  return new ChatOpenAI({
    model: modelName,
    temperature: options?.temperature ?? 0.7,
    ...(options?.maxTokens !== undefined
      ? { maxTokens: options.maxTokens }
      : {}),
    timeout: options?.timeoutMs ?? 120_000,
    apiKey: config.apiKey,
    ...(callbacks ? { callbacks } : {}),
    ...(config.baseURL || config.headers
      ? {
          configuration: {
            ...(config.baseURL ? { baseURL: config.baseURL } : {}),
            ...(config.headers ? { defaultHeaders: config.headers } : {}),
          },
        }
      : {}),
  });
}

/**
 * Create a LangChain ChatOpenAI instance using the unified config.
 * Business code passes only use-case options — no apiKey / baseURL.
 */
export function createLangChainChatModel(
  options?: CreateLangChainChatModelOptions,
) {
  const config = resolveOpenAICompatibleConfig();
  return createChatModelFromConfig(config, options);
}

export function createLangChainChatModelForUseCase(
  options: CreateLangChainChatModelForUseCaseOptions,
) {
  const route = resolveAiModelRoute({
    useCase: options.useCase,
    userTier: options.userTier,
  });
  const config = resolveOpenAICompatibleProviderConfig({
    providerId: route.providerId,
    defaultModel: route.model,
  });

  return createChatModelFromConfig(config, {
    ...options,
    model: options.model ?? route.model,
    temperature: options.temperature ?? route.temperature,
    maxTokens: options.maxTokens ?? route.maxTokens,
  });
}

export interface CreateLangChainEmbeddingsOptions {
  /** Override the default embeddings model resolved from env */
  model?: string;
}

export interface CreateLangChainEmbeddingsForUseCaseOptions
  extends CreateLangChainEmbeddingsOptions {
  useCase: AiUseCase;
  userTier?: AiUserTier;
}

function createEmbeddingsFromConfig(
  config: ReturnType<typeof resolveOpenAICompatibleConfig>,
  model: string,
) {
  return new OpenAIEmbeddings({
    model,
    openAIApiKey: config.apiKey,
    ...(config.baseURL || config.headers
      ? {
          configuration: {
            ...(config.baseURL ? { baseURL: config.baseURL } : {}),
            ...(config.headers ? { defaultHeaders: config.headers } : {}),
          },
        }
      : {}),
  });
}

/**
 * Create a LangChain OpenAIEmbeddings instance using the unified config.
 * Gemini and plain OpenAI are both handled transparently.
 */
export function createLangChainEmbeddings(
  options?: CreateLangChainEmbeddingsOptions,
) {
  const defaultEmbeddingConfig = resolveDefaultEmbeddingModel();
  const defaultEmbeddingModel = defaultEmbeddingConfig.model;

  const config = resolveOpenAICompatibleConfig({
    defaultModel: defaultEmbeddingModel,
  });

  return createEmbeddingsFromConfig(
    config,
    options?.model ?? defaultEmbeddingModel,
  );
}

export function createLangChainEmbeddingsForUseCase(
  options: CreateLangChainEmbeddingsForUseCaseOptions,
) {
  const route = resolveAiModelRoute({
    useCase: options.useCase,
    userTier: options.userTier,
  });
  const config = resolveOpenAICompatibleProviderConfig({
    providerId: route.providerId,
    defaultModel: route.model,
  });

  return createEmbeddingsFromConfig(config, options.model ?? route.model);
}

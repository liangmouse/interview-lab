import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import {
  resolveDefaultEmbeddingModel,
  resolveOpenAICompatibleConfig,
} from "./openai-compatible-config";
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
  tracing?: LangfuseTracingContext;
}

/**
 * Create a LangChain ChatOpenAI instance using the unified config.
 * Business code passes only use-case options — no apiKey / baseURL.
 */
export function createLangChainChatModel(
  options?: CreateLangChainChatModelOptions,
) {
  const config = resolveOpenAICompatibleConfig();
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

export interface CreateLangChainEmbeddingsOptions {
  /** Override the default embeddings model resolved from env */
  model?: string;
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

  const model = options?.model ?? defaultEmbeddingModel;

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

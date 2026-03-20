import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { resolveOpenAICompatibleConfig } from "./openai-compatible-config";

export interface CreateLangChainChatModelOptions {
  /** Override the default model resolved from env */
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Create a LangChain ChatOpenAI instance using the unified config.
 * Business code passes only use-case options — no apiKey / baseURL.
 */
export function createLangChainChatModel(
  options?: CreateLangChainChatModelOptions,
) {
  const config = resolveOpenAICompatibleConfig({
    defaultModel: "gemini-3-flash-preview",
  });

  return new ChatOpenAI({
    model: options?.model ?? config.model,
    temperature: options?.temperature ?? 0.7,
    ...(options?.maxTokens !== undefined
      ? { maxTokens: options.maxTokens }
      : {}),
    apiKey: config.apiKey,
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
  const defaultEmbeddingModel =
    process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY
      ? process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001"
      : "text-embedding-3-small";

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

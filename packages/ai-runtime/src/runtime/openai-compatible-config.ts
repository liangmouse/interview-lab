/**
 * Unified OpenAI-compatible configuration resolver.
 *
 * Business code never reads process.env directly for API keys.
 * This module is the single place that resolves provider config from env vars.
 */

export interface OpenAICompatibleConfig {
  /** Logical provider identifier, e.g. "openai" or "gemini" */
  providerId: string;
  apiKey: string;
  /** Custom base URL for OpenAI-compatible endpoints (e.g. Gemini, OpenRouter) */
  baseURL?: string;
  model: string;
  /** Extra HTTP headers to forward to the provider (e.g. OpenRouter site headers) */
  headers?: Record<string, string>;
}

export interface ResolveOpenAICompatibleConfigOptions {
  /** Fallback model when no model env var is set */
  defaultModel?: string;
}

export type OpenAICompatibleProviderId = "openrouter" | "openai" | "gemini";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
export const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
export const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash";
export const DEFAULT_OPENROUTER_EMBEDDING_MODEL =
  "openai/text-embedding-3-small";

function trimString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getOpenRouterApiKey(env: NodeJS.ProcessEnv) {
  return trimString(env.OPEN_ROUTER_API_KEY) || trimString(env.OPEN_ROUTER_API);
}

export function hasConfiguredOpenAICompatibleProvider(
  providerId: OpenAICompatibleProviderId,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  switch (providerId) {
    case "openrouter":
      return Boolean(getOpenRouterApiKey(env));
    case "openai":
      return Boolean(trimString(env.OPENAI_API_KEY));
    case "gemini":
      return Boolean(trimString(env.GEMINI_API_KEY));
    default:
      return false;
  }
}

function getOpenRouterHeaders(env: NodeJS.ProcessEnv) {
  const headers: Record<string, string> = {};
  const referer = trimString(env.OPEN_ROUTER_HTTP_REFERER);
  const title = trimString(env.OPEN_ROUTER_TITLE);

  if (referer) {
    headers["HTTP-Referer"] = referer;
  }

  if (title) {
    headers["X-Title"] = title;
  }

  return Object.keys(headers).length > 0 ? headers : undefined;
}

export function resolveOpenAICompatibleProviderConfig(input: {
  providerId: OpenAICompatibleProviderId;
  defaultModel: string;
  env?: NodeJS.ProcessEnv;
}): OpenAICompatibleConfig {
  const env = input.env ?? process.env;

  switch (input.providerId) {
    case "openrouter": {
      const apiKey = getOpenRouterApiKey(env);
      if (!apiKey) {
        throw new Error(
          "OpenRouter provider not configured: set OPEN_ROUTER_API_KEY or OPEN_ROUTER_API",
        );
      }

      return {
        providerId: "openrouter",
        apiKey,
        baseURL: trimString(env.OPEN_ROUTER_BASE_URL) || OPENROUTER_BASE_URL,
        model: input.defaultModel,
        headers: getOpenRouterHeaders(env),
      };
    }
    case "openai": {
      const apiKey = trimString(env.OPENAI_API_KEY);
      if (!apiKey) {
        throw new Error("OpenAI provider not configured: set OPENAI_API_KEY");
      }

      return {
        providerId: "openai",
        apiKey,
        baseURL: trimString(env.OPENAI_BASE_URL),
        model: input.defaultModel,
      };
    }
    case "gemini": {
      const apiKey = trimString(env.GEMINI_API_KEY);
      if (!apiKey) {
        throw new Error("Gemini provider not configured: set GEMINI_API_KEY");
      }

      return {
        providerId: "gemini",
        apiKey,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
        model: input.defaultModel,
      };
    }
  }
}

export function resolveDefaultEmbeddingModel(): {
  providerId: string;
  model: string;
} {
  const env = process.env;

  if (getOpenRouterApiKey(env)) {
    return {
      providerId: "openrouter",
      model:
        trimString(env.OPEN_ROUTER_EMBEDDING_MODEL) ||
        DEFAULT_OPENROUTER_EMBEDDING_MODEL,
    };
  }

  if (trimString(env.OPENAI_API_KEY)) {
    return {
      providerId: "openai",
      model: "text-embedding-3-small",
    };
  }

  return {
    providerId: "gemini",
    model: trimString(env.GEMINI_EMBEDDING_MODEL) || "gemini-embedding-001",
  };
}

/**
 * Resolve provider configuration from environment variables.
 *
 * Priority:
 * 1. OPEN_ROUTER_API_KEY / OPEN_ROUTER_API (+ optional OPEN_ROUTER_* vars)
 * 2. OPENAI_API_KEY (+ optional OPENAI_BASE_URL / OPENAI_MODEL)
 * 3. GEMINI_API_KEY (Gemini OpenAI-compatible endpoint, + optional GEMINI_MODEL)
 *
 * @throws if neither OPEN_ROUTER_API_KEY / OPEN_ROUTER_API, OPENAI_API_KEY nor GEMINI_API_KEY is set
 */
export function resolveOpenAICompatibleConfig(
  options?: ResolveOpenAICompatibleConfigOptions,
): OpenAICompatibleConfig {
  const env = process.env;

  const openRouterKey = getOpenRouterApiKey(env);
  if (openRouterKey) {
    const baseURL = trimString(env.OPEN_ROUTER_BASE_URL) || OPENROUTER_BASE_URL;
    const model =
      trimString(env.OPEN_ROUTER_MODEL) ||
      options?.defaultModel ||
      DEFAULT_OPENROUTER_MODEL;

    return {
      providerId: "openrouter",
      apiKey: openRouterKey,
      baseURL,
      model,
      headers: getOpenRouterHeaders(env),
    };
  }

  const openaiKey = trimString(env.OPENAI_API_KEY);
  if (openaiKey) {
    const baseURL = trimString(env.OPENAI_BASE_URL);
    const model =
      trimString(env.OPENAI_MODEL) ||
      options?.defaultModel ||
      DEFAULT_OPENAI_MODEL;
    return { providerId: "openai", apiKey: openaiKey, baseURL, model };
  }

  const geminiKey = trimString(env.GEMINI_API_KEY);
  if (geminiKey) {
    const model =
      trimString(env.GEMINI_MODEL) ||
      options?.defaultModel ||
      DEFAULT_GEMINI_MODEL;
    return {
      providerId: "gemini",
      apiKey: geminiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      model,
    };
  }

  throw new Error(
    "LLM provider not configured: set OPEN_ROUTER_API_KEY/OPEN_ROUTER_API, OPENAI_API_KEY, or GEMINI_API_KEY",
  );
}

/**
 * Validate that a usable LLM provider is configured.
 */
export function validateLlmConfig(): { isValid: boolean; error?: string } {
  const openRouterKey = getOpenRouterApiKey(process.env);
  const openaiKey = trimString(process.env.OPENAI_API_KEY);
  const geminiKey = trimString(process.env.GEMINI_API_KEY);

  const key = openRouterKey || openaiKey || geminiKey;
  if (!key) {
    return {
      isValid: false,
      error:
        "LLM provider not configured: set OPEN_ROUTER_API_KEY/OPEN_ROUTER_API, OPENAI_API_KEY, or GEMINI_API_KEY",
    };
  }

  if (key.length < 10) {
    return {
      isValid: false,
      error: "API key appears to be invalid (too short)",
    };
  }

  return { isValid: true };
}

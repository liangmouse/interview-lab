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

/**
 * Resolve provider configuration from environment variables.
 *
 * Priority:
 * 1. OPENAI_API_KEY (+ optional OPENAI_BASE_URL / OPENAI_MODEL)
 * 2. GEMINI_API_KEY (Gemini OpenAI-compatible endpoint, + optional GEMINI_MODEL)
 *
 * @throws if neither OPENAI_API_KEY nor GEMINI_API_KEY is set
 */
export function resolveOpenAICompatibleConfig(
  options?: ResolveOpenAICompatibleConfigOptions,
): OpenAICompatibleConfig {
  const env = process.env;

  const openaiKey = env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    const baseURL = env.OPENAI_BASE_URL?.trim() || undefined;
    const model =
      env.OPENAI_MODEL?.trim() || options?.defaultModel || "gpt-4o-mini";
    return { providerId: "openai", apiKey: openaiKey, baseURL, model };
  }

  const geminiKey = env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    const model =
      env.GEMINI_MODEL?.trim() ||
      options?.defaultModel ||
      "gemini-3-flash-preview";
    return {
      providerId: "gemini",
      apiKey: geminiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      model,
    };
  }

  throw new Error(
    "LLM provider not configured: set OPENAI_API_KEY or GEMINI_API_KEY",
  );
}

/**
 * Validate that a usable LLM provider is configured.
 */
export function validateLlmConfig(): { isValid: boolean; error?: string } {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  const key = openaiKey || geminiKey;
  if (!key) {
    return {
      isValid: false,
      error:
        "LLM provider not configured: set OPENAI_API_KEY or GEMINI_API_KEY",
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

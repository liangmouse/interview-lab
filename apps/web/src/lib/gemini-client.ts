/**
 * Backward-compatible shim — delegates to the unified ai-runtime entry.
 * New code should import from @interviewclaw/ai-runtime directly.
 */
import {
  resolveOpenAICompatibleConfig,
  validateLlmConfig,
} from "@interviewclaw/ai-runtime";

export { validateLlmConfig as validateGeminiConfig };

export function getGeminiOpenAICompatConfig() {
  const config = resolveOpenAICompatibleConfig();
  return {
    apiKey: config.apiKey,
    model: config.model,
    baseURL:
      config.baseURL ??
      (config.providerId === "gemini"
        ? "https://generativelanguage.googleapis.com/v1beta/openai"
        : "https://api.openai.com/v1"),
  };
}

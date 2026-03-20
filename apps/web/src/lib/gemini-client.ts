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
  const config = resolveOpenAICompatibleConfig({
    defaultModel: "gemini-3-flash-preview",
  });
  return {
    apiKey: config.apiKey,
    model: config.model,
    baseURL:
      config.baseURL ??
      "https://generativelanguage.googleapis.com/v1beta/openai",
  };
}

/**
 * 验证 Gemini API 配置
 */
export function validateGeminiConfig(): { isValid: boolean; error?: string } {
  if (!process.env.GEMINI_API_KEY) {
    return {
      isValid: false,
      error: "GEMINI_API_KEY environment variable is not set",
    };
  }

  if (process.env.GEMINI_API_KEY.length < 10) {
    return {
      isValid: false,
      error: "GEMINI_API_KEY appears to be invalid (too short)",
    };
  }

  return { isValid: true };
}

/**
 * 获取 Gemini 调用配置（OpenAI 兼容端点）
 */
export function getGeminiOpenAICompatConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
  };
}

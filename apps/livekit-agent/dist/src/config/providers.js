import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as openai from "@livekit/agents-plugin-openai";
import { GeminiTTS } from "../plugins/gemini-tts-plugin";
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
export const GEMINI_NATIVE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview";
export const DEFAULT_GEMINI_TEMPERATURE = 0.4;
// 默认使用 Deepgram 的高精度通用模型（多语言）
export const DEFAULT_DEEPGRAM_MODEL = "nova-3-general";
export const DEFAULT_DEEPGRAM_LANGUAGE = "zh";
export const DEFAULT_DEEPGRAM_SMART_FORMAT = true;
export const DEEPGRAM_KEYTERM_LIMIT = 20;
export const DEFAULT_GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
export const DEFAULT_GEMINI_TTS_VOICE = "Kore";
function requireEnv(name) {
    const v = process.env[name];
    const resolved = typeof v === "string" ? v.trim() : "";
    if (!resolved) {
        throw new Error(`[Agent Config] Missing required env: ${name}`);
    }
    return resolved;
}
export function getGeminiApiKey() {
    return requireEnv("GEMINI_API_KEY");
}
export function getDeepgramApiKey() {
    return requireEnv("DEEPGRAM_API_KEY");
}
export function getGeminiModel() {
    const v = process.env.GEMINI_MODEL;
    const resolved = typeof v === "string" ? v.trim() : "";
    return resolved || DEFAULT_GEMINI_MODEL;
}
export function getDeepgramModel() {
    const v = process.env.DEEPGRAM_MODEL;
    const resolved = typeof v === "string" ? v.trim() : "";
    return resolved || DEFAULT_DEEPGRAM_MODEL;
}
export function getDeepgramLanguage() {
    const v = process.env.DEEPGRAM_LANGUAGE;
    const resolved = typeof v === "string" ? v.trim() : "";
    if (!resolved)
        return DEFAULT_DEEPGRAM_LANGUAGE;
    const normalized = resolved.toLowerCase();
    if (normalized === "en-us" || normalized === "en")
        return "en-US";
    if (normalized === "zh-cn" || normalized === "zh_cn" || normalized === "zh")
        return "zh";
    return resolved;
}
function resolveDeepgramModel(language) {
    const model = getDeepgramModel();
    const lang = language.toLowerCase();
    const isEnglish = lang === "en-us" || lang === "en";
    // nova-3 系列目前仅支持英文，非英文时提前回退，避免 400
    if (!isEnglish && model.startsWith("nova-3")) {
        return "nova-2-general";
    }
    return model;
}
export function createDeepgramSTT(keyterm, language) {
    const cleanedKeyterms = Array.isArray(keyterm)
        ? keyterm
            .filter((k) => typeof k === "string" && k.trim())
            .slice(0, DEEPGRAM_KEYTERM_LIMIT)
        : [];
    const resolvedLanguage = language || getDeepgramLanguage();
    const resolvedModel = resolveDeepgramModel(resolvedLanguage);
    const normalizedLanguage = resolvedLanguage.toLowerCase();
    const isEnglish = normalizedLanguage === "en" || normalizedLanguage === "en-us";
    // Deepgram 对非英文场景的 keyword boost 支持有限，且 SDK 会对 keywords 进行双重编码导致 400，
    // 因此仅保留 keyterm 作为提示词，keywords 置空。
    const keywords = [];
    // keyterm 在非英文场景下容易触发 Deepgram 400（尤其包含中文词汇时），仅在英文启用
    const resolvedKeyterms = isEnglish ? cleanedKeyterms : [];
    const sttInstance = new deepgram.STT({
        apiKey: getDeepgramApiKey(),
        // 使用 as any 绕过类型检查，最新模型在类型定义中可能缺失
        model: resolvedModel,
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
export function createGeminiTTS(language) {
    const isEnglish = language === null || language === void 0 ? void 0 : language.toLowerCase().startsWith("en");
    const voice = isEnglish ? "Zephyr" : DEFAULT_GEMINI_TTS_VOICE;
    return new GeminiTTS({
        apiKey: getGeminiApiKey(),
        model: process.env.GEMINI_TTS_MODEL || DEFAULT_GEMINI_TTS_MODEL,
        voiceName: voice,
        baseUrl: GEMINI_NATIVE_BASE_URL,
        sampleRate: 24000,
    });
}

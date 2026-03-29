import type { stt } from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import {
  DEFAULT_VOLCENGINE_RESOURCE_ID,
  VolcEngineSTT,
  type VolcEngineSTTOptions,
} from "./volcengine-stt";
import type {
  ResolvedSttConfig,
  SttProviderFactory,
  SttProviderId,
  SttRuntimeOverrides,
} from "./types";

export type {
  ResolvedSttConfig,
  SttProviderFactory,
  SttProviderId,
  SttRuntimeOverrides,
} from "./types";
export { VolcEngineSTT, type VolcEngineSTTOptions } from "./volcengine-stt";

// ─── 默认配置 ───────────────────────────────────────────────────────────────

/** 当前默认 STT Provider */
export const DEFAULT_STT_PROVIDER: SttProviderId = "volcengine";

export const DEFAULT_STT_LANGUAGE = "zh";

// Deepgram 相关默认值（保留兼容）
const DEEPGRAM_MODEL = "nova-3-general";
const DEEPGRAM_SMART_FORMAT = true;
const DEEPGRAM_KEYTERM_LIMIT = 20;

// ─── Provider 工厂注册 ──────────────────────────────────────────────────────

const providerFactories: Record<SttProviderId, SttProviderFactory> = {
  volcengine: {
    id: "volcengine",
    create(config) {
      const appId = trimString(process.env.VOLCENGINE_STT_APP_ID) ?? "";
      const accessToken =
        trimString(process.env.VOLCENGINE_STT_ACCESS_TOKEN) ?? "";

      if (!appId || !accessToken) {
        throw new Error(
          "[STT Config] Missing required env: VOLCENGINE_STT_APP_ID and VOLCENGINE_STT_ACCESS_TOKEN",
        );
      }

      return new VolcEngineSTT({
        appId,
        accessToken,
        resourceId:
          trimString(process.env.VOLCENGINE_STT_RESOURCE_ID) ??
          DEFAULT_VOLCENGINE_RESOURCE_ID,
        wsUrl: trimString(process.env.VOLCENGINE_STT_WS_URL),
        boostingTableId: trimString(
          process.env.VOLCENGINE_STT_BOOSTING_TABLE_ID,
        ),
        sampleRate: 16000,
        interimResults: false,
        language: config.language,
        keywords: config.keywords.length > 0 ? config.keywords : undefined,
      });
    },
  },
  deepgram: {
    id: "deepgram",
    create(config) {
      const apiKey = trimString(process.env.DEEPGRAM_API_KEY);
      if (!apiKey) {
        throw new Error("[STT Config] Missing required env: DEEPGRAM_API_KEY");
      }

      const language = config.language || DEFAULT_STT_LANGUAGE;
      const isEnglish =
        language.toLowerCase() === "en" || language.toLowerCase() === "en-us";

      // nova-3 仅英文，非英文回退 nova-2-general
      const model =
        !isEnglish && DEEPGRAM_MODEL.startsWith("nova-3")
          ? "nova-2-general"
          : DEEPGRAM_MODEL;

      // Deepgram 中文 keyterm 会触发 400，仅英文启用
      const keyterms = isEnglish
        ? config.keywords.slice(0, DEEPGRAM_KEYTERM_LIMIT)
        : [];

      return new deepgram.STT({
        apiKey,
        model: model as any,
        language,
        smartFormat: DEEPGRAM_SMART_FORMAT,
        keywords: [],
        keyterm: keyterms,
      });
    },
  },
};

// ─── 公开 API ───────────────────────────────────────────────────────────────

/**
 * 创建 STT 实例。
 *
 * @param providerId  选择 Provider，默认 volcengine
 * @param keywords    热词/关键词列表
 * @param language    语言代码
 */
export function createSTT(
  providerId: SttProviderId = DEFAULT_STT_PROVIDER,
  keywords: string[] = [],
  language: string = DEFAULT_STT_LANGUAGE,
): stt.STT {
  const factory = providerFactories[providerId];
  if (!factory) {
    throw new Error(`[STT] Unknown provider: ${providerId}`);
  }

  const config: ResolvedSttConfig = {
    providerId,
    language,
    keywords: keywords.filter((k) => typeof k === "string" && k.trim()),
  };

  return factory.create(config);
}

// ─── 内部工具 ───────────────────────────────────────────────────────────────

function trimString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

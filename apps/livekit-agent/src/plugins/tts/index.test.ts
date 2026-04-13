import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTtsFromConfig,
  DEFAULT_TTS_CLUSTER,
  DEFAULT_TTS_SAMPLE_RATE,
  DEFAULT_TTS_VOICE,
  resolveTtsConfig,
} from "./index";
import { VolcengineTTS } from "./volcengine-tts";

describe("plugins/tts.resolveTtsConfig", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    for (const key of [
      "VOLCENGINE_TTS_APP_ID",
      "VOLCENGINE_TTS_ACCESS_TOKEN",
      "VOLCENGINE_TTS_CLUSTER",
    ]) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("从环境变量解析火山引擎配置", () => {
    process.env.VOLCENGINE_TTS_APP_ID = "my-app-id";
    process.env.VOLCENGINE_TTS_ACCESS_TOKEN = "my-token";

    const config = resolveTtsConfig("zh-CN");

    expect(config).toMatchObject({
      providerId: "volcengine",
      appId: "my-app-id",
      apiKey: "my-token",
      cluster: DEFAULT_TTS_CLUSTER,
      voice: DEFAULT_TTS_VOICE,
      sampleRate: DEFAULT_TTS_SAMPLE_RATE,
    });
  });

  it("支持自定义 cluster", () => {
    process.env.VOLCENGINE_TTS_APP_ID = "my-app-id";
    process.env.VOLCENGINE_TTS_ACCESS_TOKEN = "my-token";
    process.env.VOLCENGINE_TTS_CLUSTER = "custom_cluster";

    const config = resolveTtsConfig("zh-CN");

    expect(config.cluster).toBe("custom_cluster");
  });

  it("支持运行时 voice 覆盖", () => {
    process.env.VOLCENGINE_TTS_APP_ID = "my-app-id";
    process.env.VOLCENGINE_TTS_ACCESS_TOKEN = "my-token";

    const config = resolveTtsConfig("zh-CN", { voice: "BV701_streaming" });

    expect(config.voice).toBe("BV701_streaming");
  });

  it("支持运行时 sampleRate 覆盖", () => {
    process.env.VOLCENGINE_TTS_APP_ID = "my-app-id";
    process.env.VOLCENGINE_TTS_ACCESS_TOKEN = "my-token";

    const config = resolveTtsConfig("zh-CN", { sampleRate: 16000 });

    expect(config.sampleRate).toBe(16000);
  });

  it("缺少 VOLCENGINE_TTS_APP_ID 时抛出错误", () => {
    process.env.VOLCENGINE_TTS_ACCESS_TOKEN = "my-token";

    expect(() => resolveTtsConfig("zh-CN")).toThrow(
      "[TTS Config] Missing required env: VOLCENGINE_TTS_APP_ID",
    );
  });

  it("缺少 VOLCENGINE_TTS_ACCESS_TOKEN 时抛出错误", () => {
    process.env.VOLCENGINE_TTS_APP_ID = "my-app-id";

    expect(() => resolveTtsConfig("zh-CN")).toThrow(
      "[TTS Config] Missing required env: VOLCENGINE_TTS_ACCESS_TOKEN",
    );
  });

  it("createTtsFromConfig 返回 VolcengineTTS 实例", () => {
    process.env.VOLCENGINE_TTS_APP_ID = "my-app-id";
    process.env.VOLCENGINE_TTS_ACCESS_TOKEN = "my-token";

    const config = resolveTtsConfig("zh-CN");
    const ttsInstance = createTtsFromConfig(config);

    expect(ttsInstance).toBeInstanceOf(VolcengineTTS);
    expect(ttsInstance.label).toBe("volcengine.TTS");
  });
});

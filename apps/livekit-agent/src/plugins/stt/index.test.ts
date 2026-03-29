import { beforeEach, describe, expect, it, vi } from "vitest";

const deepgramConstructor = vi.fn((opts: unknown) => ({
  kind: "deepgram-stt",
  opts,
}));
const volcengineConstructor = vi.fn((opts: unknown) => ({
  kind: "volcengine-stt",
  opts,
}));

vi.mock("@livekit/agents-plugin-deepgram", () => ({
  STT: vi.fn(function MockDeepgram(this: unknown, opts: unknown) {
    deepgramConstructor(opts);
    return {
      kind: "deepgram-stt",
      opts,
    };
  }),
}));

vi.mock("./volcengine-stt", () => ({
  DEFAULT_VOLCENGINE_RESOURCE_ID: "volc.bigasr.sauc.duration",
  VolcEngineSTT: vi.fn(function MockVolcEngineSTT(
    this: unknown,
    opts: unknown,
  ) {
    volcengineConstructor(opts);
    return {
      kind: "volcengine-stt",
      opts,
    };
  }),
}));

describe("plugins/stt.createSTT", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    delete process.env.DEEPGRAM_API_KEY;
    delete process.env.VOLCENGINE_STT_APP_ID;
    delete process.env.VOLCENGINE_STT_ACCESS_TOKEN;
    delete process.env.VOLCENGINE_STT_RESOURCE_ID;
    delete process.env.VOLCENGINE_STT_WS_URL;
    delete process.env.VOLCENGINE_STT_BOOSTING_TABLE_ID;
  });

  it("uses volcengine as the default provider with default resource id", async () => {
    process.env.VOLCENGINE_STT_APP_ID = "app-id";
    process.env.VOLCENGINE_STT_ACCESS_TOKEN = "access-token";

    const { createSTT, DEFAULT_STT_PROVIDER } = await import("./index");

    const instance = createSTT();

    expect(DEFAULT_STT_PROVIDER).toBe("volcengine");
    expect(instance).toMatchObject({ kind: "volcengine-stt" });
    expect(volcengineConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "app-id",
        accessToken: "access-token",
        resourceId: "volc.bigasr.sauc.duration",
        sampleRate: 16000,
        interimResults: false,
        language: "zh",
      }),
    );
  });

  it("passes resource and boosting config into the volcengine provider", async () => {
    process.env.VOLCENGINE_STT_APP_ID = "app-id";
    process.env.VOLCENGINE_STT_ACCESS_TOKEN = "access-token";
    process.env.VOLCENGINE_STT_RESOURCE_ID = "volc.custom";
    process.env.VOLCENGINE_STT_BOOSTING_TABLE_ID = "boosting-table-id";
    process.env.VOLCENGINE_STT_WS_URL = "wss://example.com/stt";

    const { createSTT } = await import("./index");

    createSTT("volcengine", ["React", "Vue"], "zh-CN");

    expect(volcengineConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: "volc.custom",
        boostingTableId: "boosting-table-id",
        wsUrl: "wss://example.com/stt",
        keywords: ["React", "Vue"],
        language: "zh-CN",
      }),
    );
  });

  it("throws when volcengine credentials are missing", async () => {
    const { createSTT } = await import("./index");

    expect(() => createSTT()).toThrow(
      "[STT Config] Missing required env: VOLCENGINE_STT_APP_ID and VOLCENGINE_STT_ACCESS_TOKEN",
    );
  });

  it("still supports Deepgram as a non-default provider", async () => {
    process.env.DEEPGRAM_API_KEY = "deepgram-key";

    const { createSTT } = await import("./index");

    const instance = createSTT("deepgram", ["Node.js"], "en-US");

    expect(instance).toMatchObject({ kind: "deepgram-stt" });
    expect(deepgramConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "deepgram-key",
        language: "en-US",
        keyterm: ["Node.js"],
      }),
    );
  });
});

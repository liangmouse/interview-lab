import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@livekit/agents", () => {
  class MockQueue<T> {
    private values: T[] = [];
    private closed = false;
    private error: Error | null = null;
    private waiter: (() => void) | null = null;

    put(value: T) {
      this.values.push(value);
      this.waiter?.();
      this.waiter = null;
    }

    close() {
      this.closed = true;
      this.waiter?.();
      this.waiter = null;
    }

    fail(error: Error) {
      this.error = error;
      this.closed = true;
      this.waiter?.();
      this.waiter = null;
    }

    async *iterate() {
      while (true) {
        if (this.values.length > 0) {
          yield this.values.shift() as T;
          continue;
        }
        if (this.error) {
          throw this.error;
        }
        if (this.closed) {
          return;
        }
        await new Promise<void>((resolve) => {
          this.waiter = resolve;
        });
      }
    }
  }

  class TTS {
    constructor(
      public sampleRate: number,
      public numChannels: number,
      public capabilities?: { streaming?: boolean },
    ) {}
  }

  class ChunkedStream {
    protected queue = new MockQueue<unknown>();
    protected inputText: string;
    protected tts: TTS;

    constructor(text: string, ttsInstance: TTS) {
      this.inputText = text;
      this.tts = ttsInstance;

      Promise.resolve()
        .then(() => this.run())
        .catch((error) => {
          this.queue.fail(
            error instanceof Error ? error : new Error(String(error)),
          );
        });
    }

    protected async run(): Promise<void> {}

    [Symbol.asyncIterator]() {
      return this.queue.iterate();
    }
  }

  class StreamAdapter {
    constructor(
      public ttsInstance: TTS,
      public tokenizer: unknown,
    ) {}

    stream() {
      return { ttsInstance: this.ttsInstance, tokenizer: this.tokenizer };
    }
  }

  class AudioByteStream {
    constructor(
      private readonly sampleRate: number,
      private readonly channels: number,
    ) {}

    write(buffer: ArrayBuffer) {
      if (buffer.byteLength === 0) return [];
      return [
        {
          sampleRate: this.sampleRate,
          channels: this.channels,
          data: new Int16Array(buffer),
        },
      ];
    }

    flush() {
      return [];
    }
  }

  return {
    shortuuid: vi.fn(() => "request-1"),
    tokenize: { basic: { SentenceTokenizer: class SentenceTokenizer {} } },
    AudioByteStream,
    tts: { TTS, ChunkedStream, StreamAdapter },
  };
});

import { createVolcengineTTS, VolcengineTTS } from "./volcengine-tts";

const MOCK_OPTS = {
  appId: "test-app-id",
  token: "test-token",
  cluster: "volcano_tts",
  voice: "BV700_streaming",
  sampleRate: 24000,
};

function makePcmBuffer(samples = 100): Buffer {
  return Buffer.alloc(samples * 2, 0);
}

async function consume(stream: AsyncIterable<unknown>) {
  for await (const _ of stream) {
    // drain
  }
}

describe("VolcengineTTS", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("构造函数缺少 appId 时抛出错误", () => {
    expect(() => new VolcengineTTS({ ...MOCK_OPTS, appId: "" })).toThrow(
      "Volcengine TTS appId is required",
    );
  });

  it("构造函数缺少 token 时抛出错误", () => {
    expect(() => new VolcengineTTS({ ...MOCK_OPTS, token: "" })).toThrow(
      "Volcengine TTS token is required",
    );
  });

  it("label 为 volcengine.TTS", () => {
    expect(new VolcengineTTS(MOCK_OPTS).label).toBe("volcengine.TTS");
  });

  it("使用正确的 HTTP 请求调用火山引擎 API", async () => {
    const pcm = makePcmBuffer(100);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 3000,
        message: "Success",
        reqid: "r1",
        data: pcm.toString("base64"),
      }),
    });

    await consume(new VolcengineTTS(MOCK_OPTS).synthesize("你好"));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openspeech.bytedance.com/api/v1/tts");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer;${MOCK_OPTS.token}`);
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string);
    expect(body.app.appid).toBe(MOCK_OPTS.appId);
    expect(body.app.token).toBe(MOCK_OPTS.token);
    expect(body.app.cluster).toBe(MOCK_OPTS.cluster);
    expect(body.audio.voice_type).toBe(MOCK_OPTS.voice);
    expect(body.audio.encoding).toBe("pcm");
    expect(body.audio.rate).toBe(MOCK_OPTS.sampleRate);
    expect(body.request.text).toBe("你好");
    expect(body.request.operation).toBe("query");
  });

  it("HTTP 错误时抛出异常", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    await expect(
      consume(new VolcengineTTS(MOCK_OPTS).synthesize("你好")),
    ).rejects.toThrow("[Volcengine TTS] HTTP 401");
  });

  it("API 返回非 3000 code 时抛出异常", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 4001,
        message: "Invalid voice type",
        reqid: "r1",
      }),
    });

    await expect(
      consume(new VolcengineTTS(MOCK_OPTS).synthesize("你好")),
    ).rejects.toThrow("[Volcengine TTS] Error 4001: Invalid voice type");
  });

  it("data 字段为空时抛出异常", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 3000,
        message: "Success",
        reqid: "r1",
        data: "",
      }),
    });

    await expect(
      consume(new VolcengineTTS(MOCK_OPTS).synthesize("你好")),
    ).rejects.toThrow("[Volcengine TTS] Empty audio payload");
  });

  it("createVolcengineTTS 从 ResolvedTtsConfig 正确创建实例", () => {
    const instance = createVolcengineTTS({
      providerId: "volcengine",
      appId: "my-app-id",
      apiKey: "my-token",
      cluster: "volcano_tts",
      voice: "BV700_streaming",
      sampleRate: 24000,
    });
    expect(instance).toBeInstanceOf(VolcengineTTS);
    expect(instance.label).toBe("volcengine.TTS");
  });
});

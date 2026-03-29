import { afterEach, describe, expect, it, vi } from "vitest";
import { gunzipSync, gzipSync } from "node:zlib";

type QueueResult<T> = IteratorResult<T>;

vi.mock("@livekit/agents", () => {
  class MockQueue<T> {
    values: T[] = [];
    closed = false;
    error: Error | null = null;
    waiter: ((result: QueueResult<T>) => void) | null = null;

    put(value: T) {
      if (this.closed) return;
      if (this.waiter) {
        const waiter = this.waiter;
        this.waiter = null;
        waiter({ value, done: false });
        return;
      }
      this.values.push(value);
    }

    close() {
      this.closed = true;
      if (this.waiter) {
        const waiter = this.waiter;
        this.waiter = null;
        waiter({ value: undefined as T, done: true });
      }
    }

    fail(error: Error) {
      this.error = error;
      this.close();
    }

    async next(): Promise<QueueResult<T>> {
      if (this.values.length > 0) {
        return {
          value: this.values.shift() as T,
          done: false,
        };
      }

      if (this.error) {
        throw this.error;
      }

      if (this.closed) {
        return {
          value: undefined as T,
          done: true,
        };
      }

      return new Promise<QueueResult<T>>((resolve) => {
        this.waiter = resolve;
      });
    }
  }

  class AudioEnergyFilter {
    pushFrame() {
      return true;
    }
  }

  class AudioByteStream {
    constructor(
      private readonly sampleRate: number,
      private readonly channels: number,
    ) {}

    write(buffer: ArrayBuffer) {
      if (buffer.byteLength === 0) {
        return [];
      }

      const data = new Int16Array(buffer.slice(0));
      return [
        {
          data,
          sampleRate: this.sampleRate,
          channels: this.channels,
          samplesPerChannel: data.length / this.channels,
        },
      ];
    }

    flush() {
      return [];
    }
  }

  class STT {
    constructor(public readonly capabilities: unknown) {}
  }

  class SpeechStream {
    static readonly FLUSH_SENTINEL = Symbol("flush");
    protected input = new MockQueue<unknown>();
    protected queue = new MockQueue<unknown>();
    protected output = this.queue;
    protected closed = false;

    constructor(_stt: unknown, _sampleRate?: number) {
      Promise.resolve()
        .then(() => this.run())
        .then(() => {
          this.closed = true;
          this.queue.close();
        })
        .catch((error) => {
          this.queue.fail(
            error instanceof Error ? error : new Error(String(error)),
          );
        });
    }

    protected async run(): Promise<void> {}

    pushFrame(frame: unknown) {
      this.input.put(frame);
    }

    flush() {
      this.input.put(SpeechStream.FLUSH_SENTINEL);
    }

    endInput() {
      this.input.close();
    }

    next() {
      return this.queue.next();
    }

    [Symbol.asyncIterator]() {
      return this;
    }
  }

  return {
    AudioByteStream,
    AudioEnergyFilter,
    log: () => ({
      warn: vi.fn(),
      error: vi.fn(),
    }),
    shortuuid: vi.fn(() => "request-1"),
    stt: {
      STT,
      SpeechStream,
      SpeechEventType: {
        START_OF_SPEECH: 0,
        INTERIM_TRANSCRIPT: 1,
        FINAL_TRANSCRIPT: 2,
        END_OF_SPEECH: 3,
        RECOGNITION_USAGE: 4,
      },
    },
  };
});

vi.mock("ws", () => {
  class MockWebSocket {
    static OPEN = 1;
    static instances: MockWebSocket[] = [];

    url: string;
    options: Record<string, unknown>;
    binaryType = "";
    readyState = MockWebSocket.OPEN;
    sent: unknown[] = [];
    listeners = new Map<string, Array<(...args: any[]) => void>>();

    constructor(url: string, options: Record<string, unknown>) {
      this.url = url;
      this.options = options;
      MockWebSocket.instances.push(this);
      queueMicrotask(() => this.emit("open"));
    }

    on(event: string, listener: (...args: any[]) => void) {
      const list = this.listeners.get(event) ?? [];
      list.push(listener);
      this.listeners.set(event, list);
      return this;
    }

    send(payload: unknown) {
      this.sent.push(payload);
    }

    close(code = 1000) {
      this.readyState = 3;
      this.emit("close", code);
    }

    emit(event: string, ...args: any[]) {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(...args);
      }
    }
  }

  return {
    WebSocket: MockWebSocket,
  };
});

import {
  __internal,
  DEFAULT_VOLCENGINE_RESOURCE_ID,
  DEFAULT_VOLCENGINE_WS_URL,
  VolcEngineSTT,
} from "./volcengine-stt";

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

function decodeMessage(buffer: Buffer) {
  const messageType = (buffer[1] >> 4) & 0x0f;
  const flags = buffer[1] & 0x0f;
  const serialization = (buffer[2] >> 4) & 0x0f;
  const compression = buffer[2] & 0x0f;
  const payloadSize = buffer.readUInt32BE(4);
  let payload = buffer.subarray(8, 8 + payloadSize);

  if (compression === 0b0001) {
    payload = gunzipSync(payload);
  }

  return {
    messageType,
    flags,
    serialization,
    payload:
      serialization === 0b0001
        ? JSON.parse(payload.toString("utf-8"))
        : payload,
  };
}

function encodeServerJson(payload: Record<string, unknown>) {
  const zipped = gzipSync(Buffer.from(JSON.stringify(payload), "utf-8"));
  const header = Buffer.from([0x11, 0x90, 0x11, 0x00]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(zipped.length);
  return Buffer.concat([header, size, zipped]);
}

describe("plugins/stt/volcengine-stt", () => {
  afterEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    const { WebSocket } = await import("ws");
    (WebSocket as any).instances.length = 0;
  });

  it("builds the expected websocket headers and first request payload", async () => {
    const stt = new VolcEngineSTT({
      appId: "app-id",
      accessToken: "access-token",
      resourceId: "volc.custom",
      wsUrl: "wss://example.com/bigasr",
      boostingTableId: "boosting-table-id",
      keywords: ["React", "张三"],
      language: "zh",
    });

    const stream = stt.stream();
    await flushMicrotasks();

    const { WebSocket } = await import("ws");
    const socket = (WebSocket as any).instances[0];

    expect(socket.url).toBe("wss://example.com/bigasr");
    expect(socket.options).toMatchObject({
      headers: {
        "X-Api-App-Key": "app-id",
        "X-Api-Access-Key": "access-token",
        "X-Api-Resource-Id": "volc.custom",
        "X-Api-Request-Id": "request-1",
      },
    });

    const firstMessage = decodeMessage(socket.sent[0] as Buffer);
    expect(firstMessage.messageType).toBe(0b0001);
    expect(firstMessage.payload).toMatchObject({
      app: {
        appid: "app-id",
        token: "access-token",
        cluster: "volc.custom",
      },
      user: {
        uid: "request-1",
      },
      audio: {
        format: "pcm",
        codec: "raw",
        rate: 16000,
        bits: 16,
        channel: 1,
        language: "zh-CN",
      },
      request: {
        reqid: "request-1",
        model_name: "bigmodel",
        enable_punc: true,
        enable_itn: true,
        show_utterances: true,
        corpus: {
          boosting_table_id: "boosting-table-id",
        },
        context: {
          context_type: "dialog_ctx",
          context_data: "React 张三",
        },
      },
    });
    expect((firstMessage.payload as any).request.workflow).toBeUndefined();
    expect((firstMessage.payload as any).request.hotwords).toBeUndefined();

    stream.endInput();
    await flushMicrotasks();
    socket.close(1000);
  });

  it("emits transcript, end-of-speech, and usage events for final utterances", async () => {
    const stt = new VolcEngineSTT({
      appId: "app-id",
      accessToken: "access-token",
      resourceId: DEFAULT_VOLCENGINE_RESOURCE_ID,
      wsUrl: DEFAULT_VOLCENGINE_WS_URL,
      keywords: ["DeepSeek"],
      language: "zh-CN",
    });

    const stream = stt.stream();
    await flushMicrotasks();

    const { WebSocket } = await import("ws");
    const socket = (WebSocket as any).instances[0];

    stream.pushFrame({
      data: new Int16Array([1, 2, 3, 4]),
      sampleRate: 16000,
      channels: 1,
      samplesPerChannel: 4,
    } as any);
    await flushMicrotasks();

    const audioMessage = decodeMessage(socket.sent[1] as Buffer);
    expect(audioMessage.messageType).toBe(0b0010);

    socket.emit(
      "message",
      encodeServerJson({
        request_id: "request-1",
        result: {
          is_final: true,
          utterances: [
            {
              text: "你好 React 工程师",
              definite: true,
              start_time: 0,
              end_time: 1200,
              confidence: 0.98,
            },
          ],
        },
      }),
    );

    const start = await stream.next();
    const transcript = await stream.next();
    const end = await stream.next();

    expect(start.value).toMatchObject({
      type: 0,
    });
    expect(transcript.value).toMatchObject({
      type: 2,
      requestId: "request-1",
      alternatives: [
        expect.objectContaining({
          text: "你好 React 工程师",
          language: "zh-CN",
        }),
      ],
    });
    expect(end.value).toMatchObject({
      type: 3,
      requestId: "request-1",
      alternatives: [
        expect.objectContaining({
          text: "你好 React 工程师",
        }),
      ],
    });

    stream.flush();
    const usage = await stream.next();
    expect(usage.value).toMatchObject({
      type: 4,
      requestId: "request-1",
      recognitionUsage: {
        audioDuration: 4 / 16000,
      },
    });

    stream.endInput();
    await flushMicrotasks();
    socket.close(1000);
  });

  it("parses nested response payloads and surfaces upstream errors", () => {
    expect(
      __internal.parseRecognitionResult(
        {
          request_id: "req-1",
          result: {
            is_final: true,
            utterances: [
              {
                text: "请介绍一下你的项目",
                definite: true,
                start_time: 100,
                end_time: 900,
                confidence: 0.95,
              },
            ],
          },
        },
        "zh-CN",
      ),
    ).toMatchObject({
      requestId: "req-1",
      isFinal: true,
      items: [
        {
          text: "请介绍一下你的项目",
          startTime: 0.1,
          endTime: 0.9,
          final: true,
        },
      ],
    });

    expect(
      __internal.parseRecognitionResult(
        {
          code: 1022,
          message: "quota exceeded",
        },
        "zh-CN",
      ),
    ).toMatchObject({
      items: [],
      errorMessage: "quota exceeded",
    });
  });
});

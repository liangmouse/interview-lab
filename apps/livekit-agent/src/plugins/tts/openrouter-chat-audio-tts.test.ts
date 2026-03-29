import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

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
      return {
        ttsInstance: this.ttsInstance,
        tokenizer: this.tokenizer,
      };
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
    tokenize: {
      basic: {
        SentenceTokenizer: class SentenceTokenizer {},
      },
    },
    AudioByteStream,
    tts: {
      TTS,
      ChunkedStream,
      StreamAdapter,
    },
  };
});

import {
  extractChatCompletionAudio,
  OpenRouterChatAudioTTS,
} from "./openrouter-chat-audio-tts";

async function collectSynthesis(tts: OpenRouterChatAudioTTS, text = "你好") {
  const chunks = [];
  for await (const chunk of tts.synthesize(text)) {
    chunks.push(chunk);
  }
  return chunks;
}

describe("plugins/tts/openrouter-chat-audio-tts", () => {
  const originalFetch = global.fetch;

  afterAll(() => {
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("extracts audio data from chat completion payload", () => {
    const payload = {
      choices: [
        {
          message: {
            audio: {
              data: "QUJDRA==",
              format: "pcm",
            },
          },
        },
      ],
    };

    expect(extractChatCompletionAudio(payload)).toEqual({
      data: "QUJDRA==",
      format: "pcm",
    });
  });

  it("requests OpenRouter chat completions with audio output and emits frames", async () => {
    const fetch = vi.fn<typeof global.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                audio: {
                  data: Buffer.from([0, 0, 1, 0]).toString("base64"),
                  format: "pcm",
                },
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    global.fetch = fetch;

    const tts = new OpenRouterChatAudioTTS({
      apiKey: "openrouter-key",
      model: "openai/gpt-audio-mini",
      voice: "alloy",
      baseUrl: "https://openrouter.ai/api/v1",
      sampleRate: 24000,
      audioFormat: "pcm",
      headers: {
        "HTTP-Referer": "https://example.com",
        "X-Title": "InterviewClaw",
      },
    });

    const chunks = await collectSynthesis(tts);

    expect(fetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer openrouter-key",
          "HTTP-Referer": "https://example.com",
          "X-Title": "InterviewClaw",
        }),
      }),
    );
    const init = fetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "openai/gpt-audio-mini",
      modalities: ["text", "audio"],
      audio: {
        voice: "alloy",
        format: "pcm",
      },
      stream: true,
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.at(-1)?.final).toBe(true);
  });

  it("throws a clear error when the response has no audio payload", async () => {
    global.fetch = vi.fn<typeof global.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: {} }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const tts = new OpenRouterChatAudioTTS({
      apiKey: "openrouter-key",
      model: "openai/gpt-audio-mini",
      voice: "alloy",
      baseUrl: "https://openrouter.ai/api/v1",
      sampleRate: 24000,
      audioFormat: "pcm",
    });

    await expect(collectSynthesis(tts)).rejects.toThrow(
      "[OpenRouter TTS] Missing audio in chat completion",
    );
  });

  it("throws upstream HTTP errors with context", async () => {
    global.fetch = vi
      .fn<typeof global.fetch>()
      .mockResolvedValue(new Response("quota exceeded", { status: 429 }));

    const tts = new OpenRouterChatAudioTTS({
      apiKey: "openrouter-key",
      model: "openai/gpt-audio-mini",
      voice: "alloy",
      baseUrl: "https://openrouter.ai/api/v1",
      sampleRate: 24000,
      audioFormat: "pcm",
    });

    await expect(collectSynthesis(tts)).rejects.toThrow(
      "[OpenRouter TTS] HTTP 429: quota exceeded",
    );
  });
});

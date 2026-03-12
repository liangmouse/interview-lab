import { AudioByteStream, shortuuid, tokenize, tts } from "@livekit/agents";
import type { AudioFrame } from "@livekit/rtc-node";

export interface GeminiTTSOptions {
  apiKey: string;
  model: string;
  voiceName: string;
  baseUrl?: string;
  sampleRate?: number;
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
  }>;
};

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_SAMPLE_RATE = 24000;
const DEFAULT_CHANNELS = 1;

export function extractInlineAudioBase64(payload: unknown): string | null {
  const data = payload as GeminiGenerateContentResponse;
  const candidates = data?.candidates;
  if (!Array.isArray(candidates)) return null;

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) continue;

    for (const part of parts) {
      const base64 = part?.inlineData?.data;
      if (typeof base64 === "string" && base64.length > 0) {
        return base64;
      }
    }
  }

  return null;
}

export class GeminiTTS extends tts.TTS {
  label = "gemini.TTS";
  private readonly opts: Required<GeminiTTSOptions>;

  constructor(options: GeminiTTSOptions) {
    if (!options.apiKey) {
      throw new Error("GEMINI_API_KEY missing");
    }

    const resolved: Required<GeminiTTSOptions> = {
      apiKey: options.apiKey,
      model: options.model,
      voiceName: options.voiceName,
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      sampleRate: options.sampleRate ?? DEFAULT_SAMPLE_RATE,
    };

    super(resolved.sampleRate, DEFAULT_CHANNELS, { streaming: true });
    this.opts = resolved;
  }

  synthesize(text: string): GeminiChunkedStream {
    return new GeminiChunkedStream(this, text, this.opts);
  }

  stream(): tts.SynthesizeStream {
    const sentenceTokenizer = new tokenize.basic.SentenceTokenizer();
    return new tts.StreamAdapter(this, sentenceTokenizer).stream();
  }
}

class GeminiChunkedStream extends tts.ChunkedStream {
  label = "gemini.ChunkedStream";
  private readonly opts: Required<GeminiTTSOptions>;

  constructor(
    ttsInstance: GeminiTTS,
    text: string,
    opts: Required<GeminiTTSOptions>,
  ) {
    super(text, ttsInstance);
    this.opts = opts;
  }

  protected async run(): Promise<void> {
    const requestId = shortuuid();
    const segmentId = requestId;

    const endpoint = `${this.opts.baseUrl}/models/${this.opts.model}:generateContent`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-goog-api-key": this.opts.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: this.inputText }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.opts.voiceName,
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response
        .text()
        .catch(() => "(failed to read response)");
      throw new Error(
        `[Gemini TTS] HTTP ${response.status}: ${errorBody.slice(0, 500)}`,
      );
    }

    const payload = (await response.json()) as GeminiGenerateContentResponse;
    const base64Audio = extractInlineAudioBase64(payload);
    if (!base64Audio) {
      throw new Error("[Gemini TTS] Missing inline audio in response");
    }

    const pcmBuffer = Buffer.from(base64Audio, "base64");
    if (pcmBuffer.byteLength === 0) {
      throw new Error("[Gemini TTS] Empty inline audio payload");
    }

    const audioByteStream = new AudioByteStream(
      this.opts.sampleRate,
      DEFAULT_CHANNELS,
    );
    const frames = audioByteStream.write(
      pcmBuffer.buffer.slice(
        pcmBuffer.byteOffset,
        pcmBuffer.byteOffset + pcmBuffer.byteLength,
      ),
    );

    let lastFrame: AudioFrame | undefined;
    const sendLastFrame = (final: boolean) => {
      if (!lastFrame) return;
      this.queue.put({
        requestId,
        segmentId,
        frame: lastFrame,
        final,
      });
      lastFrame = undefined;
    };

    for (const frame of frames) {
      sendLastFrame(false);
      lastFrame = frame;
    }

    for (const frame of audioByteStream.flush()) {
      sendLastFrame(false);
      lastFrame = frame;
    }

    sendLastFrame(true);
    this.queue.close();
  }
}

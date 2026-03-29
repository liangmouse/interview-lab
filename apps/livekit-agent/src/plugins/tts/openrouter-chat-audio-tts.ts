import { shortuuid, tokenize, tts } from "@livekit/agents";
import type { ResolvedTtsConfig, TtsAudioFormat } from "./types";
import { decodeWaveToPcm16Mono, emitPcmFrames } from "./audio-utils";

type OpenRouterAudioResponse = {
  choices?: Array<{
    message?: {
      audio?: {
        data?: string;
        format?: string;
      };
    };
  }>;
};

export interface OpenRouterChatAudioTTSOptions {
  apiKey: string;
  model: string;
  voice: string;
  baseUrl: string;
  sampleRate: number;
  audioFormat: TtsAudioFormat;
  headers?: Record<string, string>;
}

export function extractChatCompletionAudio(
  payload: unknown,
): { data: string; format?: string } | null {
  const data = payload as OpenRouterAudioResponse;
  const choices = data?.choices;
  if (!Array.isArray(choices)) return null;

  for (const choice of choices) {
    const audio = choice?.message?.audio;
    if (audio && typeof audio.data === "string" && audio.data.length > 0) {
      return {
        data: audio.data,
        format:
          typeof audio.format === "string" && audio.format.trim()
            ? audio.format.trim()
            : undefined,
      };
    }
  }

  return null;
}

export class OpenRouterChatAudioTTS extends tts.TTS {
  label = "openrouter.chat-audio.TTS";
  private readonly opts: OpenRouterChatAudioTTSOptions;

  constructor(options: OpenRouterChatAudioTTSOptions) {
    if (!options.apiKey) {
      throw new Error("OpenRouter API key is required");
    }

    super(options.sampleRate, 1, { streaming: true });
    this.opts = options;
  }

  synthesize(text: string): OpenRouterChatAudioChunkedStream {
    return new OpenRouterChatAudioChunkedStream(this, text, this.opts);
  }

  stream(): tts.SynthesizeStream {
    return new tts.StreamAdapter(
      this,
      new tokenize.basic.SentenceTokenizer(),
    ).stream();
  }
}

class OpenRouterChatAudioChunkedStream extends tts.ChunkedStream {
  label = "openrouter.chat-audio.ChunkedStream";
  private readonly opts: OpenRouterChatAudioTTSOptions;

  constructor(
    ttsInstance: OpenRouterChatAudioTTS,
    text: string,
    opts: OpenRouterChatAudioTTSOptions,
  ) {
    super(text, ttsInstance);
    this.opts = opts;
  }

  protected async run(): Promise<void> {
    const requestId = shortuuid();
    const segmentId = requestId;
    const endpoint = `${this.opts.baseUrl}/chat/completions`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json",
        ...(this.opts.headers ?? {}),
      },
      body: JSON.stringify({
        model: this.opts.model,
        messages: [{ role: "user", content: this.inputText }],
        modalities: ["text", "audio"],
        audio: {
          voice: this.opts.voice,
          format: this.opts.audioFormat,
        },
        // OpenRouter requires stream: true for audio output
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorBody = await response
        .text()
        .catch(() => "(failed to read response)");
      throw new Error(
        `[OpenRouter TTS] HTTP ${response.status}: ${errorBody.slice(0, 500)}`,
      );
    }

    const body = await response.text();
    const audio = extractAudioFromResponseBody(body);

    if (!audio) {
      throw new Error("[OpenRouter TTS] Missing audio in chat completion");
    }

    const rawBuffer = Buffer.from(audio.data, "base64");
    if (rawBuffer.byteLength === 0) {
      throw new Error("[OpenRouter TTS] Empty audio payload");
    }

    const format = normalizeAudioFormat(audio.format) ?? this.opts.audioFormat;
    const pcmBuffer =
      format === "wav"
        ? decodeWaveToPcm16Mono(rawBuffer, this.opts.sampleRate)
        : rawBuffer;

    emitPcmFrames({
      queue: this.queue,
      requestId,
      segmentId,
      sampleRate: this.opts.sampleRate,
      pcmBuffer,
    });
  }
}

function extractAudioFromResponseBody(
  body: string,
): { data: string; format?: string } | null {
  const directPayload = tryParseJson(body);
  const directAudio = directPayload
    ? extractChatCompletionAudio(directPayload)
    : null;
  if (directAudio) {
    return directAudio;
  }

  let audioDataAccumulated = "";
  let audioFormatFromStream: string | undefined;

  for (const line of body.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (data === "[DONE]") break;
    const chunk = tryParseJson(data) as OpenRouterAudioResponse | null;
    if (!chunk) continue;

    for (const choice of chunk.choices ?? []) {
      const audio = (choice as any)?.delta?.audio ?? choice?.message?.audio;
      if (audio && typeof audio.data === "string" && audio.data.length > 0) {
        audioDataAccumulated += audio.data;
        if (typeof audio.format === "string" && audio.format.trim()) {
          audioFormatFromStream = audio.format.trim();
        }
      }
    }
  }

  return audioDataAccumulated
    ? { data: audioDataAccumulated, format: audioFormatFromStream }
    : null;
}

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeAudioFormat(value?: string): TtsAudioFormat | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "pcm" || normalized === "pcm16" || normalized === "wav") {
    return normalized as TtsAudioFormat;
  }
  return null;
}

export function createOpenRouterChatAudioTTS(config: ResolvedTtsConfig) {
  return new OpenRouterChatAudioTTS({
    apiKey: config.apiKey,
    model: config.model,
    voice: config.voice,
    baseUrl: config.baseURL,
    sampleRate: config.sampleRate,
    audioFormat: config.audioFormat,
    headers: config.headers,
  });
}

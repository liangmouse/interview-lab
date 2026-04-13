import { shortuuid, tokenize, tts } from "@livekit/agents";
import type { ResolvedTtsConfig } from "./types";
import { emitPcmFrames } from "./audio-utils";

type VolcengineTtsResponse = {
  code: number;
  message: string;
  reqid: string;
  data?: string;
};

export interface VolcengineTTSOptions {
  appId: string;
  token: string;
  cluster: string;
  voice: string;
  sampleRate: number;
}

export class VolcengineTTS extends tts.TTS {
  label = "volcengine.TTS";
  private readonly opts: VolcengineTTSOptions;

  constructor(options: VolcengineTTSOptions) {
    if (!options.appId) {
      throw new Error("Volcengine TTS appId is required");
    }
    if (!options.token) {
      throw new Error("Volcengine TTS token is required");
    }
    super(options.sampleRate, 1, { streaming: true });
    this.opts = options;
  }

  synthesize(text: string): VolcengineChunkedStream {
    return new VolcengineChunkedStream(this, text, this.opts);
  }

  stream(): tts.SynthesizeStream {
    return new tts.StreamAdapter(
      this,
      new tokenize.basic.SentenceTokenizer(),
    ).stream();
  }
}

class VolcengineChunkedStream extends tts.ChunkedStream {
  label = "volcengine.ChunkedStream";
  private readonly opts: VolcengineTTSOptions;

  constructor(
    ttsInstance: VolcengineTTS,
    text: string,
    opts: VolcengineTTSOptions,
  ) {
    super(text, ttsInstance);
    this.opts = opts;
  }

  protected async run(): Promise<void> {
    const requestId = shortuuid();
    const segmentId = requestId;

    const response = await fetch(
      "https://openspeech.bytedance.com/api/v1/tts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer;${this.opts.token}`,
        },
        body: JSON.stringify({
          app: {
            appid: this.opts.appId,
            token: this.opts.token,
            cluster: this.opts.cluster,
          },
          user: { uid: "interview-lab" },
          audio: {
            voice_type: this.opts.voice,
            encoding: "pcm",
            rate: this.opts.sampleRate,
            speed_ratio: 1.0,
          },
          request: {
            reqid: requestId,
            text: this.inputText,
            text_type: "plain",
            operation: "query",
          },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response
        .text()
        .catch(() => "(failed to read response)");
      throw new Error(
        `[Volcengine TTS] HTTP ${response.status}: ${errorBody.slice(0, 500)}`,
      );
    }

    const json = (await response.json()) as VolcengineTtsResponse;

    if (json.code !== 3000) {
      throw new Error(`[Volcengine TTS] Error ${json.code}: ${json.message}`);
    }

    if (!json.data) {
      throw new Error("[Volcengine TTS] Empty audio payload");
    }

    const pcmBuffer = Buffer.from(json.data, "base64");
    if (pcmBuffer.byteLength === 0) {
      throw new Error("[Volcengine TTS] Empty audio payload");
    }

    emitPcmFrames({
      queue: this.queue,
      requestId,
      segmentId,
      sampleRate: this.opts.sampleRate,
      pcmBuffer,
    });
  }
}

export function createVolcengineTTS(config: ResolvedTtsConfig): VolcengineTTS {
  return new VolcengineTTS({
    appId: config.appId,
    token: config.apiKey,
    cluster: config.cluster,
    voice: config.voice,
    sampleRate: config.sampleRate,
  });
}

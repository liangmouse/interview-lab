import {
  AudioByteStream,
  AudioEnergyFilter,
  log,
  shortuuid,
  stt,
} from "@livekit/agents";
import type { AudioFrame } from "@livekit/rtc-node";
import { gunzipSync, gzipSync } from "node:zlib";
import { WebSocket } from "ws";

const PROTOCOL_VERSION = 0b0001;
const HEADER_SIZE = 0b0001;

const MSG_FULL_CLIENT_REQUEST = 0b0001;
const MSG_AUDIO_ONLY = 0b0010;
const MSG_FULL_SERVER_RESPONSE = 0b1001;
const MSG_SERVER_ERROR = 0b1111;

const FLAG_NONE = 0b0000;
const FLAG_LAST_PACKET = 0b0010;

const SERIAL_JSON = 0b0001;
const SERIAL_NONE = 0b0000;

const COMPRESS_GZIP = 0b0001;
const SAMPLE_RATE = 16000;
const NUM_CHANNELS = 1;

export const DEFAULT_VOLCENGINE_WS_URL =
  "wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream";
export const DEFAULT_VOLCENGINE_RESOURCE_ID = "volc.bigasr.sauc.duration";
export const DEFAULT_VOLCENGINE_MODEL_NAME = "bigmodel";

export interface VolcEngineSTTOptions {
  appId: string;
  accessToken: string;
  resourceId?: string;
  wsUrl?: string;
  sampleRate?: number;
  interimResults?: boolean;
  language?: string;
  boostingTableId?: string;
  keywords?: string[];
}

interface VolcUtterance {
  text?: string;
  definite?: boolean;
  is_final?: boolean;
  start_time?: number;
  end_time?: number;
  confidence?: number;
}

interface VolcServerResponse {
  request_id?: string;
  reqid?: string;
  code?: number | string;
  message?: string;
  result?: {
    text?: string;
    is_final?: boolean;
    confidence?: number;
    utterances?: VolcUtterance[];
  };
  text?: string;
  is_final?: boolean;
  confidence?: number;
  utterances?: VolcUtterance[];
}

interface ParsedTranscriptItem {
  text: string;
  confidence: number;
  startTime: number;
  endTime: number;
  final: boolean;
}

interface ParsedRecognitionResult {
  requestId?: string;
  errorMessage?: string;
  isFinal: boolean;
  items: ParsedTranscriptItem[];
}

function buildHeader(
  messageType: number,
  flags: number,
  serialization: number,
  compression: number,
): Buffer {
  const header = Buffer.alloc(4);
  header[0] = ((PROTOCOL_VERSION & 0x0f) << 4) | (HEADER_SIZE & 0x0f);
  header[1] = ((messageType & 0x0f) << 4) | (flags & 0x0f);
  header[2] = ((serialization & 0x0f) << 4) | (compression & 0x0f);
  header[3] = 0x00;
  return header;
}

function encodeJsonMessage(
  messageType: number,
  payload: Record<string, unknown>,
): Buffer {
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), "utf-8"));
  const header = buildHeader(
    messageType,
    FLAG_NONE,
    SERIAL_JSON,
    COMPRESS_GZIP,
  );
  const sizeBuffer = Buffer.alloc(4);
  sizeBuffer.writeUInt32BE(compressed.length);
  return Buffer.concat([header, sizeBuffer, compressed]);
}

function encodeAudioMessage(audioData: Buffer, isLast: boolean): Buffer {
  const compressed = gzipSync(audioData);
  const header = buildHeader(
    MSG_AUDIO_ONLY,
    isLast ? FLAG_LAST_PACKET : FLAG_NONE,
    SERIAL_NONE,
    COMPRESS_GZIP,
  );
  const sizeBuffer = Buffer.alloc(4);
  sizeBuffer.writeUInt32BE(compressed.length);
  return Buffer.concat([header, sizeBuffer, compressed]);
}

function parseServerMessage(data: Buffer): {
  messageType: number;
  payload: VolcServerResponse | null;
} {
  if (data.length < 8) {
    return { messageType: 0, payload: null };
  }

  const messageType = (data[1] >> 4) & 0x0f;
  const serialization = (data[2] >> 4) & 0x0f;
  const compression = data[2] & 0x0f;
  const payloadSize = data.readUInt32BE(4);

  if (payloadSize <= 0 || data.length < 8 + payloadSize) {
    return { messageType, payload: null };
  }

  let payload = data.subarray(8, 8 + payloadSize);
  if (compression === COMPRESS_GZIP) {
    payload = gunzipSync(payload);
  }

  if (serialization !== SERIAL_JSON) {
    return { messageType, payload: null };
  }

  return {
    messageType,
    payload: JSON.parse(payload.toString("utf-8")) as VolcServerResponse,
  };
}

function normalizeLanguage(language?: string): string {
  const value = language?.trim().toLowerCase();
  if (!value || value === "zh" || value === "zh-cn") {
    return "zh-CN";
  }

  if (value === "en" || value === "en-us") {
    return "en-US";
  }

  return language as string;
}

function normalizeKeywords(keywords?: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const keyword of keywords ?? []) {
    const trimmed = keyword.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function buildRequestPayload(
  opts: Required<
    Pick<
      VolcEngineSTTOptions,
      | "appId"
      | "accessToken"
      | "sampleRate"
      | "interimResults"
      | "resourceId"
      | "language"
    >
  > &
    VolcEngineSTTOptions,
  requestId: string,
): Record<string, unknown> {
  const keywords = normalizeKeywords(opts.keywords);
  const request: Record<string, unknown> = {
    model_name: DEFAULT_VOLCENGINE_MODEL_NAME,
    enable_punc: true,
    enable_itn: true,
    show_utterances: true,
  };

  if (opts.boostingTableId) {
    request.corpus = {
      boosting_table_id: opts.boostingTableId,
    };
  }

  if (keywords.length > 0) {
    request.context = {
      context_type: "dialog_ctx",
      context_data: keywords.join(" "),
    };
  }

  return {
    app: {
      appid: opts.appId,
      token: opts.accessToken,
      cluster: opts.resourceId,
    },
    user: {
      uid: requestId,
    },
    audio: {
      format: "pcm",
      codec: "raw",
      rate: opts.sampleRate,
      bits: 16,
      channel: NUM_CHANNELS,
      language: normalizeLanguage(opts.language),
    },
    request: {
      reqid: requestId,
      ...request,
    },
  };
}

function buildWebSocketHeaders(
  opts: Required<
    Pick<VolcEngineSTTOptions, "appId" | "accessToken" | "resourceId">
  >,
  requestId: string,
): Record<string, string> {
  return {
    "X-Api-App-Key": opts.appId,
    "X-Api-Access-Key": opts.accessToken,
    "X-Api-Resource-Id": opts.resourceId,
    "X-Api-Request-Id": requestId,
  };
}

function toSeconds(value?: number): number {
  if (!value || value < 0) return 0;
  return value / 1000;
}

function parseRecognitionResult(
  response: VolcServerResponse,
  fallbackLanguage: string,
): ParsedRecognitionResult {
  const result = response.result ?? response;
  const requestId = response.request_id ?? response.reqid;
  const code =
    typeof response.code === "string" ? Number(response.code) : response.code;
  const isError =
    typeof code === "number" &&
    !Number.isNaN(code) &&
    code !== 0 &&
    code !== 1000;

  if (isError) {
    return {
      requestId,
      isFinal: false,
      items: [],
      errorMessage:
        response.message || `VolcEngine ASR error ${String(response.code)}`,
    };
  }

  const utterances = result.utterances ?? [];
  const items = utterances
    .filter((utterance) => utterance.text?.trim())
    .map((utterance) => ({
      text: utterance.text!.trim(),
      confidence: utterance.confidence ?? result.confidence ?? 1,
      startTime: toSeconds(utterance.start_time),
      endTime: toSeconds(utterance.end_time),
      final: Boolean(
        utterance.definite ?? utterance.is_final ?? result.is_final,
      ),
    }));

  if (items.length > 0) {
    return {
      requestId,
      isFinal: Boolean(result.is_final ?? items.every((item) => item.final)),
      items,
    };
  }

  if (!result.text?.trim()) {
    return {
      requestId,
      isFinal: Boolean(result.is_final),
      items: [],
    };
  }

  return {
    requestId,
    isFinal: Boolean(result.is_final),
    items: [
      {
        text: result.text.trim(),
        confidence: result.confidence ?? 1,
        startTime: 0,
        endTime: 0,
        final: Boolean(result.is_final),
      },
    ],
  };
}

function audioFrameToBuffer(frame: AudioFrame): Buffer {
  return Buffer.from(
    frame.data.buffer,
    frame.data.byteOffset,
    frame.data.byteLength,
  );
}

export const __internal = {
  buildHeader,
  buildRequestPayload,
  buildWebSocketHeaders,
  encodeJsonMessage,
  encodeAudioMessage,
  parseRecognitionResult,
  parseServerMessage,
};

export class VolcEngineSTT extends stt.STT {
  label = "volcengine.STT";

  #opts: Required<
    Pick<
      VolcEngineSTTOptions,
      | "appId"
      | "accessToken"
      | "sampleRate"
      | "interimResults"
      | "resourceId"
      | "language"
    >
  > &
    VolcEngineSTTOptions;

  private abortController = new AbortController();

  constructor(opts: VolcEngineSTTOptions) {
    super({
      streaming: true,
      interimResults: opts.interimResults ?? false,
    });

    if (!opts.appId || !opts.accessToken) {
      throw new Error("[VolcEngine STT] appId and accessToken are required");
    }

    this.#opts = {
      ...opts,
      sampleRate: opts.sampleRate ?? SAMPLE_RATE,
      interimResults: opts.interimResults ?? false,
      resourceId: opts.resourceId ?? DEFAULT_VOLCENGINE_RESOURCE_ID,
      language: normalizeLanguage(opts.language),
    };
  }

  async _recognize(): Promise<stt.SpeechEvent> {
    throw new Error("Recognize is not supported on VolcEngine STT");
  }

  stream(): VolcEngineSpeechStream {
    return new VolcEngineSpeechStream(this, this.#opts, this.abortController);
  }

  async close() {
    this.abortController.abort();
  }
}

class VolcEngineSpeechStream extends stt.SpeechStream {
  label = "volcengine.SpeechStream";

  #opts: VolcEngineSTTOptions & {
    sampleRate: number;
    interimResults: boolean;
    resourceId: string;
    language: string;
  };
  #audioEnergyFilter: AudioEnergyFilter;
  #logger = log();
  #requestId = "";
  #speaking = false;
  #audioDuration = 0;
  #finalAlternatives: stt.SpeechData[] = [];
  #finalKeys = new Set<string>();

  constructor(
    sttInstance: VolcEngineSTT,
    opts: VolcEngineSTTOptions & {
      sampleRate: number;
      interimResults: boolean;
      resourceId: string;
      language: string;
    },
    private abortController: AbortController,
  ) {
    super(sttInstance, opts.sampleRate);
    this.#opts = opts;
    this.#audioEnergyFilter = new AudioEnergyFilter();
  }

  protected async run() {
    const maxRetry = 8;
    let retries = 0;

    while (!this.input.closed && !this.closed) {
      try {
        await this.#runWS();
        break;
      } catch (error) {
        if (this.closed || this.input.closed) {
          this.#logger.warn(`VolcEngine STT disconnected: ${String(error)}`);
          break;
        }

        retries += 1;
        if (retries > maxRetry) {
          throw new Error(
            `Failed to connect to VolcEngine after ${retries} attempts: ${String(error)}`,
          );
        }

        const delayMs = Math.min(retries * 1000, 5000);
        this.#logger.warn(
          `VolcEngine STT connection failed, retrying in ${delayMs}ms: ${String(error)}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    this.closed = true;
  }

  async #runWS() {
    this.#requestId = shortuuid();
    const ws = new WebSocket(this.#opts.wsUrl ?? DEFAULT_VOLCENGINE_WS_URL, {
      headers: buildWebSocketHeaders(this.#opts, this.#requestId),
    });
    ws.binaryType = "arraybuffer";

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", (error: Error) => reject(error));
      ws.on("close", (code: number) =>
        reject(new Error(`WebSocket closed during connect: ${code}`)),
      );
    });

    ws.send(
      encodeJsonMessage(
        MSG_FULL_CLIENT_REQUEST,
        buildRequestPayload(this.#opts, this.#requestId),
      ),
    );

    let closing = false;

    const sendTask = async () => {
      const samples100Ms = Math.floor(this.#opts.sampleRate / 10);
      const byteStream = new AudioByteStream(
        this.#opts.sampleRate,
        NUM_CHANNELS,
        samples100Ms,
      );

      try {
        while (!this.closed) {
          const result = await this.input.next();
          if (result.done) break;

          const data = result.value;
          const frames =
            data === stt.SpeechStream.FLUSH_SENTINEL
              ? byteStream.flush()
              : byteStream.write(data.data.buffer as ArrayBuffer);

          if (data === stt.SpeechStream.FLUSH_SENTINEL) {
            this.#reportAudioDuration();
          }

          for (const frame of frames) {
            if (!this.#audioEnergyFilter.pushFrame(frame)) continue;

            this.#audioDuration += frame.samplesPerChannel / frame.sampleRate;
            ws.send(encodeAudioMessage(audioFrameToBuffer(frame), false));
          }
        }
      } finally {
        closing = true;
        this.#reportAudioDuration();
        ws.send(encodeAudioMessage(Buffer.alloc(0), true));
      }
    };

    const listenTask = new Promise<void>((resolve, reject) => {
      ws.on("message", (raw: ArrayBuffer | Buffer) => {
        try {
          const message = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
          const { messageType, payload } = parseServerMessage(message);

          if (messageType === MSG_SERVER_ERROR && payload) {
            reject(new Error(payload.message || "VolcEngine STT server error"));
            return;
          }

          if (messageType !== MSG_FULL_SERVER_RESPONSE || !payload) {
            return;
          }

          this.#handleServerResponse(payload);
        } catch (error) {
          reject(error);
        }
      });

      ws.on("close", (code: number) => {
        if (closing) {
          resolve();
          return;
        }
        reject(new Error(`WebSocket closed unexpectedly: ${code}`));
      });

      ws.on("error", (error: Error) => reject(error));
    });

    try {
      await Promise.all([sendTask(), listenTask]);
    } finally {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
  }

  #handleServerResponse(response: VolcServerResponse) {
    const parsed = parseRecognitionResult(response, this.#opts.language);
    if (parsed.errorMessage) {
      this.#logger.error(parsed.errorMessage);
      return;
    }

    const requestId = parsed.requestId || this.#requestId;
    let lastFinalAlternative: stt.SpeechData | undefined;

    for (const item of parsed.items) {
      if (!item.text.trim()) continue;

      if (!this.#speaking) {
        this.#speaking = true;
        this.queue.put({ type: stt.SpeechEventType.START_OF_SPEECH });
      }

      const alternative: stt.SpeechData = {
        language: this.#opts.language,
        text: item.text,
        startTime: item.startTime,
        endTime: item.endTime,
        confidence: item.confidence,
      };

      if (item.final) {
        lastFinalAlternative = alternative;
        this.#rememberFinalAlternative(alternative);
        this.queue.put({
          type: stt.SpeechEventType.FINAL_TRANSCRIPT,
          alternatives: [alternative],
          requestId,
        });
      } else if (this.#opts.interimResults) {
        this.queue.put({
          type: stt.SpeechEventType.INTERIM_TRANSCRIPT,
          alternatives: [alternative],
          requestId,
        });
      }
    }

    if (parsed.isFinal && this.#speaking) {
      this.#emitEndOfSpeech(requestId, lastFinalAlternative);
    }
  }

  #rememberFinalAlternative(alternative: stt.SpeechData) {
    const key = `${alternative.text}|${alternative.startTime}|${alternative.endTime}`;
    if (this.#finalKeys.has(key)) {
      return;
    }

    this.#finalKeys.add(key);
    this.#finalAlternatives.push(alternative);
  }

  #emitEndOfSpeech(requestId: string, fallback?: stt.SpeechData) {
    this.#speaking = false;

    const combined =
      this.#finalAlternatives.length > 0
        ? [
            {
              language: this.#opts.language,
              text: this.#finalAlternatives
                .map((item) => item.text)
                .join(" ")
                .trim(),
              startTime: this.#finalAlternatives[0]?.startTime ?? 0,
              endTime:
                this.#finalAlternatives[this.#finalAlternatives.length - 1]
                  ?.endTime ?? 0,
              confidence:
                this.#finalAlternatives.reduce(
                  (sum, item) => sum + item.confidence,
                  0,
                ) / this.#finalAlternatives.length,
            },
          ]
        : fallback
          ? [fallback]
          : undefined;

    this.queue.put({
      type: stt.SpeechEventType.END_OF_SPEECH,
      ...(combined
        ? { alternatives: combined as [stt.SpeechData, ...stt.SpeechData[]] }
        : {}),
      requestId,
    });

    this.#finalAlternatives = [];
    this.#finalKeys.clear();
  }

  #reportAudioDuration() {
    if (this.#audioDuration <= 0) {
      return;
    }

    this.queue.put({
      type: stt.SpeechEventType.RECOGNITION_USAGE,
      requestId: this.#requestId,
      recognitionUsage: {
        audioDuration: this.#audioDuration,
      },
    });
    this.#audioDuration = 0;
  }
}

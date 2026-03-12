import { AudioByteStream, shortuuid, tokenize, tts } from "@livekit/agents";
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_SAMPLE_RATE = 24000;
const DEFAULT_CHANNELS = 1;
export function extractInlineAudioBase64(payload) {
    var _a, _b;
    const data = payload;
    const candidates = data === null || data === void 0 ? void 0 : data.candidates;
    if (!Array.isArray(candidates))
        return null;
    for (const candidate of candidates) {
        const parts = (_a = candidate === null || candidate === void 0 ? void 0 : candidate.content) === null || _a === void 0 ? void 0 : _a.parts;
        if (!Array.isArray(parts))
            continue;
        for (const part of parts) {
            const base64 = (_b = part === null || part === void 0 ? void 0 : part.inlineData) === null || _b === void 0 ? void 0 : _b.data;
            if (typeof base64 === "string" && base64.length > 0) {
                return base64;
            }
        }
    }
    return null;
}
export class GeminiTTS extends tts.TTS {
    constructor(options) {
        var _a, _b;
        if (!options.apiKey) {
            throw new Error("GEMINI_API_KEY missing");
        }
        const resolved = {
            apiKey: options.apiKey,
            model: options.model,
            voiceName: options.voiceName,
            baseUrl: (_a = options.baseUrl) !== null && _a !== void 0 ? _a : DEFAULT_BASE_URL,
            sampleRate: (_b = options.sampleRate) !== null && _b !== void 0 ? _b : DEFAULT_SAMPLE_RATE,
        };
        super(resolved.sampleRate, DEFAULT_CHANNELS, { streaming: true });
        this.label = "gemini.TTS";
        this.opts = resolved;
    }
    synthesize(text) {
        return new GeminiChunkedStream(this, text, this.opts);
    }
    stream() {
        const sentenceTokenizer = new tokenize.basic.SentenceTokenizer();
        return new tts.StreamAdapter(this, sentenceTokenizer).stream();
    }
}
class GeminiChunkedStream extends tts.ChunkedStream {
    constructor(ttsInstance, text, opts) {
        super(text, ttsInstance);
        this.label = "gemini.ChunkedStream";
        this.opts = opts;
    }
    async run() {
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
            throw new Error(`[Gemini TTS] HTTP ${response.status}: ${errorBody.slice(0, 500)}`);
        }
        const payload = (await response.json());
        const base64Audio = extractInlineAudioBase64(payload);
        if (!base64Audio) {
            throw new Error("[Gemini TTS] Missing inline audio in response");
        }
        const pcmBuffer = Buffer.from(base64Audio, "base64");
        if (pcmBuffer.byteLength === 0) {
            throw new Error("[Gemini TTS] Empty inline audio payload");
        }
        const audioByteStream = new AudioByteStream(this.opts.sampleRate, DEFAULT_CHANNELS);
        const frames = audioByteStream.write(pcmBuffer.buffer.slice(pcmBuffer.byteOffset, pcmBuffer.byteOffset + pcmBuffer.byteLength));
        let lastFrame;
        const sendLastFrame = (final) => {
            if (!lastFrame)
                return;
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

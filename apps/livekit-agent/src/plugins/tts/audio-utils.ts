import { AudioByteStream } from "@livekit/agents";
import type { AudioFrame } from "@livekit/rtc-node";

const DEFAULT_CHANNELS = 1;

export function emitPcmFrames(args: {
  queue: {
    put: (value: {
      requestId: string;
      segmentId: string;
      frame: AudioFrame;
      final: boolean;
    }) => void;
    close: () => void;
  };
  requestId: string;
  segmentId: string;
  sampleRate: number;
  pcmBuffer: Buffer;
}) {
  const audioByteStream = new AudioByteStream(
    args.sampleRate,
    DEFAULT_CHANNELS,
  );
  const frames = audioByteStream.write(sliceArrayBuffer(args.pcmBuffer));

  let lastFrame: AudioFrame | undefined;
  const sendLastFrame = (final: boolean) => {
    if (!lastFrame) return;
    args.queue.put({
      requestId: args.requestId,
      segmentId: args.segmentId,
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
  args.queue.close();
}

export function decodeWaveToPcm16Mono(
  wavBuffer: Buffer,
  expectedSampleRate: number,
): Buffer {
  if (wavBuffer.byteLength < 44) {
    throw new Error("[OpenRouter TTS] WAV payload is too short");
  }

  if (
    wavBuffer.toString("ascii", 0, 4) !== "RIFF" ||
    wavBuffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error("[OpenRouter TTS] Invalid WAV header");
  }

  let offset = 12;
  let formatCode: number | null = null;
  let channelCount: number | null = null;
  let sampleRate: number | null = null;
  let bitsPerSample: number | null = null;
  let dataChunk: Buffer | null = null;

  while (offset + 8 <= wavBuffer.byteLength) {
    const chunkId = wavBuffer.toString("ascii", offset, offset + 4);
    const chunkSize = wavBuffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;

    if (chunkEnd > wavBuffer.byteLength) {
      throw new Error("[OpenRouter TTS] Corrupted WAV chunk length");
    }

    if (chunkId === "fmt ") {
      formatCode = wavBuffer.readUInt16LE(chunkStart);
      channelCount = wavBuffer.readUInt16LE(chunkStart + 2);
      sampleRate = wavBuffer.readUInt32LE(chunkStart + 4);
      bitsPerSample = wavBuffer.readUInt16LE(chunkStart + 14);
    } else if (chunkId === "data") {
      dataChunk = wavBuffer.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (!dataChunk) {
    throw new Error("[OpenRouter TTS] WAV payload missing data chunk");
  }

  if (formatCode !== 1) {
    throw new Error("[OpenRouter TTS] Only PCM WAV output is supported");
  }

  if (channelCount !== 1) {
    throw new Error("[OpenRouter TTS] Only mono WAV output is supported");
  }

  if (bitsPerSample !== 16) {
    throw new Error("[OpenRouter TTS] Only 16-bit WAV output is supported");
  }

  if (sampleRate !== expectedSampleRate) {
    throw new Error(
      `[OpenRouter TTS] WAV sample rate ${sampleRate} does not match expected ${expectedSampleRate}`,
    );
  }

  return dataChunk;
}

function sliceArrayBuffer(buffer: Buffer) {
  return Uint8Array.from(buffer).buffer;
}

import { ClientEventId, ServerEventId, isSessionLevelEvent } from "./events";

// Byte 0: [protocol_version(4b)=0001, header_size(4b)=0001] = 0x11
const HEADER_BYTE_0 = 0x11;

// Byte 1 high nibble = message type, low nibble = flags
const MsgType = {
  FullClientRequest: 0b0001,
  FullServerResponse: 0b1001,
  AudioOnlyRequest: 0b0010,
  AudioOnlyResponse: 0b1011,
  Error: 0b1111,
} as const;

const FLAG_EVENT_PRESENT = 0b0100;

// Byte 2 high nibble = serialization, low nibble = compression
const Serialization = { Raw: 0b0000, JSON: 0b0001 } as const;
const Compression = { None: 0b0000, Gzip: 0b0001 } as const;

type Bytes = Uint8Array<ArrayBufferLike>;

function pack(parts: Bytes[]): Bytes {
  const total = parts.reduce((s, b) => s + b.length, 0);
  const out: Bytes = new Uint8Array(total);
  let offset = 0;
  for (const b of parts) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

function u32be(value: number): Bytes {
  const buf: Bytes = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, value >>> 0, false);
  return buf;
}

function encodeFrame(params: {
  messageType: number;
  serialization: number;
  eventId: number;
  sessionId?: string;
  payload: Bytes;
}): Uint8Array {
  const { messageType, serialization, eventId, sessionId, payload } = params;

  const header: Bytes = new Uint8Array([
    HEADER_BYTE_0,
    ((messageType & 0x0f) << 4) | (FLAG_EVENT_PRESENT & 0x0f),
    ((serialization & 0x0f) << 4) | (Compression.None & 0x0f),
    0x00,
  ]);

  const eventBytes = u32be(eventId);

  let sessionPart: Bytes = new Uint8Array(0);
  if (isSessionLevelEvent(eventId) && sessionId) {
    const idBytes: Bytes = new TextEncoder().encode(sessionId);
    sessionPart = pack([u32be(idBytes.length), idBytes]);
  }

  const payloadPart = pack([u32be(payload.length), payload]);

  return pack([header, eventBytes, sessionPart, payloadPart]);
}

const enc = new TextEncoder();

export function encodeStartConnection(): Uint8Array {
  return encodeFrame({
    messageType: MsgType.FullClientRequest,
    serialization: Serialization.JSON,
    eventId: ClientEventId.StartConnection,
    payload: enc.encode("{}"),
  });
}

export function encodeFinishConnection(): Uint8Array {
  return encodeFrame({
    messageType: MsgType.FullClientRequest,
    serialization: Serialization.JSON,
    eventId: ClientEventId.FinishConnection,
    payload: enc.encode("{}"),
  });
}

export function encodeStartSession(
  sessionId: string,
  payload: Record<string, unknown>,
): Uint8Array {
  return encodeFrame({
    messageType: MsgType.FullClientRequest,
    serialization: Serialization.JSON,
    eventId: ClientEventId.StartSession,
    sessionId,
    payload: enc.encode(JSON.stringify(payload)),
  });
}

export function encodeFinishSession(sessionId: string): Uint8Array {
  return encodeFrame({
    messageType: MsgType.FullClientRequest,
    serialization: Serialization.JSON,
    eventId: ClientEventId.FinishSession,
    sessionId,
    payload: enc.encode("{}"),
  });
}

export function encodeTaskRequest(
  sessionId: string,
  audio: Uint8Array,
): Uint8Array {
  return encodeFrame({
    messageType: MsgType.AudioOnlyRequest,
    serialization: Serialization.Raw,
    eventId: ClientEventId.TaskRequest,
    sessionId,
    payload: audio,
  });
}

export function encodeSayHello(sessionId: string, content: string): Uint8Array {
  return encodeFrame({
    messageType: MsgType.FullClientRequest,
    serialization: Serialization.JSON,
    eventId: ClientEventId.SayHello,
    sessionId,
    payload: enc.encode(JSON.stringify({ content })),
  });
}

export type ParsedFrame =
  | {
      kind: "server-json";
      eventId: number;
      sessionId: string | null;
      json: unknown;
    }
  | {
      kind: "server-audio";
      eventId: number;
      sessionId: string | null;
      audio: Uint8Array;
    }
  | {
      kind: "error";
      code: number;
      message: string;
    };

export function decodeFrame(buffer: ArrayBuffer): ParsedFrame {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const msgType = (bytes[1] >> 4) & 0x0f;
  const flags = bytes[1] & 0x0f;
  const serialization = (bytes[2] >> 4) & 0x0f;

  let offset = 4;

  if (msgType === MsgType.Error) {
    const code = view.getUint32(offset, false);
    offset += 4;
    const size = view.getUint32(offset, false);
    offset += 4;
    const msg = new TextDecoder().decode(bytes.subarray(offset, offset + size));
    return { kind: "error", code, message: msg };
  }

  let eventId = 0;
  if ((flags & FLAG_EVENT_PRESENT) === FLAG_EVENT_PRESENT) {
    eventId = view.getUint32(offset, false);
    offset += 4;
  }

  let sessionId: string | null = null;
  if (eventId >= 100 && eventId < 1000 && offset + 4 <= bytes.length) {
    const sidSize = view.getUint32(offset, false);
    // Session ID is only present for session-scoped events; server may omit.
    // Guard: only consume if size is sane vs remaining bytes.
    if (sidSize > 0 && offset + 4 + sidSize <= bytes.length - 4) {
      offset += 4;
      sessionId = new TextDecoder().decode(
        bytes.subarray(offset, offset + sidSize),
      );
      offset += sidSize;
    } else if (sidSize === 0) {
      offset += 4;
    }
  }

  const payloadSize = view.getUint32(offset, false);
  offset += 4;
  const payload = bytes.subarray(offset, offset + payloadSize);

  if (msgType === MsgType.AudioOnlyResponse) {
    return { kind: "server-audio", eventId, sessionId, audio: payload };
  }

  // Full-server response or other — JSON payload
  let json: unknown = null;
  if (payloadSize > 0) {
    try {
      json = JSON.parse(new TextDecoder().decode(payload));
    } catch {
      json = new TextDecoder().decode(payload);
    }
  }
  return { kind: "server-json", eventId, sessionId, json };
}

export { MsgType, Serialization, ClientEventId, ServerEventId };

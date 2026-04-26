import { describe, expect, it } from "vitest";
import {
  encodeStartConnection,
  encodeStartSession,
  encodeTaskRequest,
  decodeFrame,
} from "./frames";
import { ServerEventId } from "./events";

describe("volc realtime protocol frames", () => {
  it("encodeStartConnection matches doc bytes", () => {
    // Doc reference: [17 20 16 0 0 0 0 1 0 0 0 2 123 125]
    const bytes = encodeStartConnection();
    expect(Array.from(bytes)).toEqual([
      17, 20, 16, 0, 0, 0, 0, 1, 0, 0, 0, 2, 123, 125,
    ]);
  });

  it("encodeStartSession matches doc bytes", () => {
    // Doc reference for SessionID=75a6126e-427f-49a1-a2c1-621143cb9db3
    // payload={"dialog":{"bot_name":"豆包","dialog_id":"","extra":null}}
    const sessionId = "75a6126e-427f-49a1-a2c1-621143cb9db3";
    const payload = {
      dialog: { bot_name: "豆包", dialog_id: "", extra: null },
    };
    const bytes = encodeStartSession(sessionId, payload);
    expect(Array.from(bytes)).toEqual([
      17, 20, 16, 0, 0, 0, 0, 100, 0, 0, 0, 36, 55, 53, 97, 54, 49, 50, 54, 101,
      45, 52, 50, 55, 102, 45, 52, 57, 97, 49, 45, 97, 50, 99, 49, 45, 54, 50,
      49, 49, 52, 51, 99, 98, 57, 100, 98, 51, 0, 0, 0, 60, 123, 34, 100, 105,
      97, 108, 111, 103, 34, 58, 123, 34, 98, 111, 116, 95, 110, 97, 109, 101,
      34, 58, 34, 232, 177, 134, 229, 140, 133, 34, 44, 34, 100, 105, 97, 108,
      111, 103, 95, 105, 100, 34, 58, 34, 34, 44, 34, 101, 120, 116, 114, 97,
      34, 58, 110, 117, 108, 108, 125, 125,
    ]);
  });

  it("encodeTaskRequest prefixes audio with session header", () => {
    const audio = new Uint8Array([1, 2, 3, 4]);
    const bytes = encodeTaskRequest("sid", audio);
    // [0x11, 0x24 (audio-only req | event flag), 0x00 (raw|none), 0x00, event=200, sid_size=3, "sid", payload_size=4, 1,2,3,4]
    expect(bytes[0]).toBe(0x11);
    expect(bytes[1]).toBe(0x24);
    expect(bytes[2]).toBe(0x00);
    expect(bytes[3]).toBe(0x00);
    // Last 4 bytes are the audio
    expect(Array.from(bytes.slice(-4))).toEqual([1, 2, 3, 4]);
  });

  it("decodeFrame round-trips a server audio response", () => {
    // Hand-craft: [0x11, (0b1011<<4 | 0b0100), 0x00, 0x00, event=ServerEventId.TTSResponse, sid_size=0, payload_size=4, 9,8,7,6]
    const header = new Uint8Array([0x11, 0xb4, 0x00, 0x00]);
    const event = new Uint8Array(4);
    new DataView(event.buffer).setUint32(0, ServerEventId.TTSResponse, false);
    const sidSize = new Uint8Array([0, 0, 0, 0]);
    const payloadSize = new Uint8Array([0, 0, 0, 4]);
    const audio = new Uint8Array([9, 8, 7, 6]);
    const combined = new Uint8Array(
      header.length +
        event.length +
        sidSize.length +
        payloadSize.length +
        audio.length,
    );
    let o = 0;
    for (const part of [header, event, sidSize, payloadSize, audio]) {
      combined.set(part, o);
      o += part.length;
    }
    const parsed = decodeFrame(combined.buffer);
    expect(parsed.kind).toBe("server-audio");
    if (parsed.kind === "server-audio") {
      expect(parsed.eventId).toBe(ServerEventId.TTSResponse);
      expect(Array.from(parsed.audio)).toEqual([9, 8, 7, 6]);
    }
  });
});

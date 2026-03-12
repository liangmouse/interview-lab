import { describe, it, expect, vi } from "vitest";

vi.mock("@livekit/rtc-node", () => {
  return {
    RoomEvent: {
      ParticipantConnected: "ParticipantConnected",
    },
  };
});

import { publishDataToRoom, waitForNonAgentParticipant } from "./livekit";

describe("runtime/livekit.publishDataToRoom", () => {
  it("publishes JSON payload to lk-chat-topic", () => {
    const publishData = vi.fn();
    const room = {
      localParticipant: {
        publishData,
      },
    } as any;

    publishDataToRoom(room, { type: "ping", ok: true });

    expect(publishData).toHaveBeenCalledTimes(1);
    const [payload, opts] = publishData.mock.calls[0];
    expect(opts).toEqual({ reliable: true, topic: "lk-chat-topic" });
    expect(payload).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(payload)).toBe(
      JSON.stringify({ type: "ping", ok: true }),
    );
  });
});

describe("runtime/livekit.waitForNonAgentParticipant", () => {
  it("returns existing remote participant that is not an agent", async () => {
    const user = { identity: "user-1" };
    const room = {
      remoteParticipants: new Map<string, any>([
        ["agent-1", { identity: "agent-1" }],
        ["user-1", user],
      ]),
    } as any;

    const got = await waitForNonAgentParticipant(room);
    expect(got).toBe(user);
  });

  it("waits for ParticipantConnected event if none present", async () => {
    const handlers = new Map<string, Function>();
    const room = {
      remoteParticipants: new Map<string, any>(),
      on: (ev: string, cb: Function) => handlers.set(ev, cb),
      off: (ev: string) => handlers.delete(ev),
    } as any;

    const p = waitForNonAgentParticipant(room);

    // agent joins first -> ignored
    handlers.get("ParticipantConnected")?.({ identity: "agent-xyz" });
    // user joins -> resolves
    const user = { identity: "user-xyz" };
    handlers.get("ParticipantConnected")?.(user);

    await expect(p).resolves.toBe(user);
  });
});

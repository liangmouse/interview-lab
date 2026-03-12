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
        };
        publishDataToRoom(room, { type: "ping", ok: true });
        expect(publishData).toHaveBeenCalledTimes(1);
        const [payload, opts] = publishData.mock.calls[0];
        expect(opts).toEqual({ reliable: true, topic: "lk-chat-topic" });
        expect(payload).toBeInstanceOf(Uint8Array);
        expect(new TextDecoder().decode(payload)).toBe(JSON.stringify({ type: "ping", ok: true }));
    });
});
describe("runtime/livekit.waitForNonAgentParticipant", () => {
    it("returns existing remote participant that is not an agent", async () => {
        const user = { identity: "user-1" };
        const room = {
            remoteParticipants: new Map([
                ["agent-1", { identity: "agent-1" }],
                ["user-1", user],
            ]),
        };
        const got = await waitForNonAgentParticipant(room);
        expect(got).toBe(user);
    });
    it("waits for ParticipantConnected event if none present", async () => {
        var _a, _b;
        const handlers = new Map();
        const room = {
            remoteParticipants: new Map(),
            on: (ev, cb) => handlers.set(ev, cb),
            off: (ev) => handlers.delete(ev),
        };
        const p = waitForNonAgentParticipant(room);
        // agent joins first -> ignored
        (_a = handlers.get("ParticipantConnected")) === null || _a === void 0 ? void 0 : _a({ identity: "agent-xyz" });
        // user joins -> resolves
        const user = { identity: "user-xyz" };
        (_b = handlers.get("ParticipantConnected")) === null || _b === void 0 ? void 0 : _b(user);
        await expect(p).resolves.toBe(user);
    });
});

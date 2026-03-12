import { RoomEvent, } from "@livekit/rtc-node";
export async function waitForNonAgentParticipant(room) {
    const existing = Array.from(room.remoteParticipants.values()).find((p) => !p.identity.startsWith("agent-"));
    if (existing)
        return existing;
    return await new Promise((resolve) => {
        const onJoin = (p) => {
            if (p.identity.startsWith("agent-"))
                return;
            room.off(RoomEvent.ParticipantConnected, onJoin);
            resolve(p);
        };
        room.on(RoomEvent.ParticipantConnected, onJoin);
    });
}
export function publishDataToRoom(room, data) {
    if (!room.localParticipant)
        return;
    const payload = new TextEncoder().encode(JSON.stringify(data));
    room.localParticipant.publishData(payload, {
        reliable: true,
        topic: "lk-chat-topic",
    });
}

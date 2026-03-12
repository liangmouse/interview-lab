import {
  type RemoteParticipant,
  type Room,
  RoomEvent,
} from "@livekit/rtc-node";

export async function waitForNonAgentParticipant(
  room: Room,
): Promise<RemoteParticipant> {
  const existing = Array.from(room.remoteParticipants.values()).find(
    (p) => !p.identity.startsWith("agent-"),
  );
  if (existing) return existing;

  return await new Promise<RemoteParticipant>((resolve) => {
    const onJoin = (p: RemoteParticipant) => {
      if (p.identity.startsWith("agent-")) return;
      room.off(RoomEvent.ParticipantConnected, onJoin);
      resolve(p);
    };
    room.on(RoomEvent.ParticipantConnected, onJoin);
  });
}

export type PublishedData = Record<string, unknown>;

export function publishDataToRoom(room: Room, data: PublishedData) {
  if (!room.localParticipant) return;
  const payload = new TextEncoder().encode(JSON.stringify(data));
  room.localParticipant.publishData(payload, {
    reliable: true,
    topic: "lk-chat-topic",
  });
}

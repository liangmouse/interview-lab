import type { ChannelKind, ConversationSession } from "./types";

type RouteInput = {
  userId: string;
  channel: ChannelKind;
  threadKey: string;
};

function createSessionId(input: RouteInput) {
  return `${input.userId}:${input.channel}:${input.threadKey}`;
}

export class SessionRouter {
  private readonly sessions = new Map<string, ConversationSession>();

  route(input: RouteInput): ConversationSession {
    const key = createSessionId(input);
    const now = new Date().toISOString();
    const existing = this.sessions.get(key);

    if (existing) {
      const refreshed = {
        ...existing,
        updatedAt: now,
      };
      this.sessions.set(key, refreshed);
      return refreshed;
    }

    const session: ConversationSession = {
      id: `session:${key}`,
      userId: input.userId,
      channel: input.channel,
      threadKey: input.threadKey,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(key, session);
    return session;
  }

  list() {
    return Array.from(this.sessions.values());
  }
}

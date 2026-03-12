function createSessionId(input) {
  return `${input.userId}:${input.channel}:${input.threadKey}`;
}
export class SessionRouter {
  constructor() {
    this.sessions = new Map();
  }
  route(input) {
    const key = createSessionId(input);
    const now = new Date().toISOString();
    const existing = this.sessions.get(key);
    if (existing) {
      const refreshed = Object.assign(Object.assign({}, existing), {
        updatedAt: now,
      });
      this.sessions.set(key, refreshed);
      return refreshed;
    }
    const session = {
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

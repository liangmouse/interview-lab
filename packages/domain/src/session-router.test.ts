import { describe, expect, it } from "vitest";
import { SessionRouter } from "./session-router";

describe("SessionRouter", () => {
  it("reuses the same conversation session for the same user, channel and thread", () => {
    const router = new SessionRouter();

    const first = router.route({
      userId: "user-1",
      channel: "telegram",
      threadKey: "thread-1",
    });
    const second = router.route({
      userId: "user-1",
      channel: "telegram",
      threadKey: "thread-1",
    });

    expect(second.id).toBe(first.id);
    expect(router.list()).toHaveLength(1);
  });

  it("creates different sessions for different channel identities", () => {
    const router = new SessionRouter();

    const telegramSession = router.route({
      userId: "user-1",
      channel: "telegram",
      threadKey: "thread-1",
    });
    const feishuSession = router.route({
      userId: "user-1",
      channel: "feishu",
      threadKey: "thread-1",
    });

    expect(feishuSession.id).not.toBe(telegramSession.id);
    expect(router.list()).toHaveLength(2);
  });
});

import { describe, it, expect, vi } from "vitest";
import { sendKickoffWithRetry } from "./kickoff";

describe("runtime/kickoff.sendKickoffWithRetry", () => {
  it("retries when agent activity is not ready and then succeeds", async () => {
    vi.useFakeTimers();
    const generateReply = vi
      .fn()
      .mockRejectedValueOnce(new Error("Agent activity not found"))
      .mockResolvedValueOnce(undefined);

    const p = sendKickoffWithRetry({
      session: { generateReply } as any,
      userProfile: { nickname: "梁爽" },
      retryDelayMs: 100,
      maxAttempts: 2,
    });

    await vi.advanceTimersByTimeAsync(100);
    await p;

    expect(generateReply).toHaveBeenCalledTimes(2);
    const lastCallArg = generateReply.mock.calls[1][0];
    expect(lastCallArg.userInput).toBe("系统：面试开场");
    expect(String(lastCallArg.instructions)).toContain(
      "你好梁爽，欢迎参加本次面试！",
    );
  });

  it("throws immediately for non-retryable errors", async () => {
    const generateReply = vi
      .fn()
      .mockRejectedValue(new Error("quota exceeded"));

    await expect(
      sendKickoffWithRetry({
        session: { generateReply } as any,
        userProfile: null,
        retryDelayMs: 10,
        maxAttempts: 3,
      }),
    ).rejects.toThrow("quota exceeded");

    expect(generateReply).toHaveBeenCalledTimes(1);
  });
});

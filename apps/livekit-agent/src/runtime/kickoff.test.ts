import { describe, it, expect, vi } from "vitest";
import {
  buildKickoffText,
  createKickoffGate,
  hasVisibleConversationMessages,
  sendKickoffWithRetry,
} from "./kickoff";

describe("runtime/kickoff.sendKickoffWithRetry", () => {
  it("retries when agent activity is not ready and then succeeds", async () => {
    vi.useFakeTimers();
    const say = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("Agent activity not found");
      })
      .mockReturnValueOnce(undefined);

    const p = sendKickoffWithRetry({
      session: { say } as any,
      userProfile: { nickname: "梁爽" },
      retryDelayMs: 100,
      maxAttempts: 2,
    });

    await vi.advanceTimersByTimeAsync(100);
    await p;

    expect(say).toHaveBeenCalledTimes(2);
    expect(say).toHaveBeenLastCalledWith(
      buildKickoffText({ nickname: "梁爽" }),
      expect.objectContaining({
        allowInterruptions: true,
        addToChatCtx: true,
      }),
    );
  });

  it("throws immediately for non-retryable errors", async () => {
    const say = vi.fn().mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    await expect(
      sendKickoffWithRetry({
        session: { say } as any,
        userProfile: null,
        retryDelayMs: 10,
        maxAttempts: 3,
      }),
    ).rejects.toThrow("quota exceeded");

    expect(say).toHaveBeenCalledTimes(1);
  });

  it("treats only user and assistant messages as visible history", () => {
    expect(
      hasVisibleConversationMessages([
        { role: "system", content: "internal setup" },
        { role: "assistant", content: "你好" },
      ]),
    ).toBe(true);

    expect(
      hasVisibleConversationMessages([
        { role: "system", content: "internal setup" },
      ]),
    ).toBe(false);
  });

  it("allows kickoff only once per interview id unless the attempt fails", () => {
    const gate = createKickoffGate();

    expect(gate.begin("interview-1")).toBe(true);
    expect(gate.begin("interview-1")).toBe(false);

    gate.fail("interview-1");
    expect(gate.begin("interview-1")).toBe(true);

    gate.complete("interview-1");
    expect(gate.begin("interview-1")).toBe(false);
    expect(gate.has("interview-1")).toBe(true);
  });
});

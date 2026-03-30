import { describe, expect, it } from "vitest";
import { createKickoffGate, hasVisibleConversationMessages } from "./kickoff";

describe("runtime/entry kickoff coordination", () => {
  it("skips kickoff when visible history already exists", () => {
    expect(
      hasVisibleConversationMessages([
        { role: "assistant", content: "你好，欢迎参加面试" },
      ]),
    ).toBe(true);
  });

  it("does not treat system-only history as a kickoff blocker", () => {
    expect(
      hasVisibleConversationMessages([
        { role: "system", content: "internal setup" },
      ]),
    ).toBe(false);
  });

  it("dedupes kickoff per interview id within a session", () => {
    const gate = createKickoffGate();

    expect(gate.begin("interview-1")).toBe(true);
    gate.complete("interview-1");

    expect(gate.begin("interview-1")).toBe(false);
    expect(gate.begin("interview-2")).toBe(true);
  });
});

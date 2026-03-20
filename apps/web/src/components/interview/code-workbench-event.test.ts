import { describe, expect, it } from "vitest";
import { resolveCodeWorkbenchEvent } from "./code-workbench-event";

const fullProblemPayload = {
  tool: "code_assessment",
  event: "start",
  questionTitle: "Reverse Linked List",
  description: "Given the head of a singly linked list, reverse it.",
  difficulty: "easy",
  language: "javascript",
  solutionTemplate: "function reverseList(head) {}",
  testTemplate: "// tests",
};

describe("resolveCodeWorkbenchEvent", () => {
  it("opens workbench when tool_event has all problem fields", () => {
    const result = resolveCodeWorkbenchEvent({
      type: "tool_event",
      data: fullProblemPayload,
    });
    expect(result).not.toBeNull();
    expect(result?.action).toBe("open");
    if (result?.action === "open") {
      expect(result.problem.title).toBe("Reverse Linked List");
      expect(result.problem.difficulty).toBe("easy");
      expect(result.problem.language).toBe("javascript");
    }
  });

  it("returns null when tool_event start is missing problem fields", () => {
    expect(
      resolveCodeWorkbenchEvent({
        type: "tool_event",
        data: { tool: "code_assessment", event: "start" },
      }),
    ).toBeNull();
  });

  it("closes workbench for code assessment end messages", () => {
    expect(resolveCodeWorkbenchEvent({ type: "code_assessment_end" })).toEqual({
      action: "close",
    });
    expect(resolveCodeWorkbenchEvent({ name: "end_code_assessment" })).toEqual({
      action: "close",
    });
    expect(
      resolveCodeWorkbenchEvent({
        type: "tool_event",
        data: { tool: "code_assessment", event: "end" },
      }),
    ).toEqual({ action: "close" });
  });

  it("returns null for unrelated messages", () => {
    expect(resolveCodeWorkbenchEvent({ type: "agent_speech" })).toBeNull();
  });
});

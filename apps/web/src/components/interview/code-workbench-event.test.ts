import { describe, expect, it } from "vitest";
import { resolveCodeWorkbenchAction } from "./code-workbench-event";

describe("resolveCodeWorkbenchAction", () => {
  it("opens workbench for code assessment start messages", () => {
    expect(resolveCodeWorkbenchAction({ type: "code_assessment_start" })).toBe(
      "open",
    );
    expect(resolveCodeWorkbenchAction({ name: "start_code_assessment" })).toBe(
      "open",
    );
    expect(
      resolveCodeWorkbenchAction({
        type: "tool_event",
        data: { tool: "code_assessment", event: "start" },
      }),
    ).toBe("open");
  });

  it("closes workbench for code assessment end messages", () => {
    expect(resolveCodeWorkbenchAction({ type: "code_assessment_end" })).toBe(
      "close",
    );
    expect(resolveCodeWorkbenchAction({ name: "end_code_assessment" })).toBe(
      "close",
    );
    expect(
      resolveCodeWorkbenchAction({
        type: "tool_event",
        data: { tool: "code_assessment", event: "end" },
      }),
    ).toBe("close");
  });

  it("returns null for unrelated messages", () => {
    expect(resolveCodeWorkbenchAction({ type: "agent_speech" })).toBeNull();
  });
});

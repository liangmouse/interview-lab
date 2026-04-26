import { describe, expect, it } from "vitest";
import { buildInterviewHref } from "@/lib/voice-kernel";

describe("buildInterviewHref", () => {
  it("builds the canonical interview href", () => {
    expect(buildInterviewHref("interview-1")).toBe("/interview/interview-1");
  });
});

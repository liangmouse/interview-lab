import { describe, expect, it } from "vitest";
import { getEditorLineNumbers, MIN_EDITOR_LINES } from "./code-editor-utils";

describe("getEditorLineNumbers", () => {
  it("returns minimum lines for empty content", () => {
    const lines = getEditorLineNumbers("");
    expect(lines.length).toBe(MIN_EDITOR_LINES);
    expect(lines[0]).toBe(1);
  });

  it("returns actual line count when content exceeds minimum", () => {
    const lines = getEditorLineNumbers("a\nb\nc", 2);
    expect(lines).toEqual([1, 2, 3]);
  });
});

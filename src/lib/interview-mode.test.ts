import { describe, expect, it } from "vitest";
import {
  buildInterviewModeHref,
  normalizeInterviewMode,
} from "@/lib/interview-mode";

describe("normalizeInterviewMode", () => {
  it("defaults to full when query is missing or invalid", () => {
    expect(normalizeInterviewMode(undefined)).toBe("full");
    expect(normalizeInterviewMode(null)).toBe("full");
    expect(normalizeInterviewMode("")).toBe("full");
    expect(normalizeInterviewMode("invalid")).toBe("full");
  });

  it("supports full and focus", () => {
    expect(normalizeInterviewMode("full")).toBe("full");
    expect(normalizeInterviewMode("focus")).toBe("focus");
  });

  it("supports array query value", () => {
    expect(normalizeInterviewMode(["focus"])).toBe("focus");
  });
});

describe("buildInterviewModeHref", () => {
  it("sets mode and keeps existing query params", () => {
    const searchParams = new URLSearchParams("foo=1&bar=2");
    expect(buildInterviewModeHref("/interview", "focus", searchParams)).toBe(
      "/interview?foo=1&bar=2&mode=focus",
    );
  });

  it("replaces existing mode query param", () => {
    const searchParams = new URLSearchParams("mode=full&foo=1");
    expect(buildInterviewModeHref("/interview", "focus", searchParams)).toBe(
      "/interview?mode=focus&foo=1",
    );
  });

  it("returns plain pathname when query is empty", () => {
    expect(
      buildInterviewModeHref("/interview", "full", new URLSearchParams()),
    ).toBe("/interview?mode=full");
  });
});

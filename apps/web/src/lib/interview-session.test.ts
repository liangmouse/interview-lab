import { describe, expect, it } from "vitest";
import {
  buildInterviewType,
  isCodingInterviewType,
  parseInterviewType,
} from "./interview-session";

describe("interview-session", () => {
  it("builds standard interview types by default", () => {
    expect(
      buildInterviewType({
        topic: "frontend",
        difficulty: "beginner",
      }),
    ).toBe("frontend:beginner");
  });

  it("builds coding interview types with an extra variant segment", () => {
    expect(
      buildInterviewType({
        topic: "fullstack",
        difficulty: "advanced",
        variant: "coding",
      }),
    ).toBe("fullstack:advanced:coding");
  });

  it("parses topic, difficulty and coding variant", () => {
    expect(parseInterviewType("fullstack:expert:coding")).toEqual({
      raw: "fullstack:expert:coding",
      topic: "fullstack",
      difficulty: "expert",
      variant: "coding",
    });
  });

  it("falls back safely for empty values", () => {
    expect(parseInterviewType("")).toEqual({
      raw: "",
      topic: null,
      difficulty: null,
      variant: "standard",
    });
    expect(isCodingInterviewType("")).toBe(false);
  });
});

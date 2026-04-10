import { beforeEach, describe, expect, it } from "vitest";
import {
  buildCodingSourcePlan,
  clearCodingInterviewProblemCache,
  CODING_INTERVIEW_GENERATION_TIMEOUT_MS,
} from "./coding-interview-service";

describe("coding-interview-service", () => {
  beforeEach(() => {
    clearCodingInterviewProblemCache();
  });

  it("builds a deterministic weighted source plan per interview", () => {
    const first = buildCodingSourcePlan("interview-a");
    const second = buildCodingSourcePlan("interview-a");

    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(
      first.every((item) => item === "resume" || item === "leetcode"),
    ).toBe(true);
  });

  it("supports custom question counts", () => {
    expect(buildCodingSourcePlan("interview-b", 5)).toHaveLength(5);
  });

  it("uses an explicit timeout budget for async generation", () => {
    expect(CODING_INTERVIEW_GENERATION_TIMEOUT_MS).toBe(8000);
  });
});

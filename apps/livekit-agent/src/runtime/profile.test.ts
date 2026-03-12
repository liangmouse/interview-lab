import { describe, it, expect } from "vitest";
import { getCandidateName } from "./profile";

describe("runtime/profile.getCandidateName", () => {
  it("returns trimmed nickname when present", () => {
    expect(getCandidateName({ nickname: " 梁爽 " })).toBe("梁爽");
  });

  it("returns null when nickname missing/blank", () => {
    expect(getCandidateName({})).toBeNull();
    expect(getCandidateName({ nickname: "" })).toBeNull();
    expect(getCandidateName({ nickname: "   " })).toBeNull();
  });

  it("returns null for non-object values", () => {
    expect(getCandidateName(null)).toBeNull();
    expect(getCandidateName(undefined)).toBeNull();
    expect(getCandidateName("x")).toBeNull();
    expect(getCandidateName(123)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  buildAuthTabHref,
  normalizeAuthTab,
  resolveAuthEntryTarget,
} from "@/lib/auth-routing";

describe("resolveAuthEntryTarget", () => {
  it("returns sign-in for guest users", () => {
    expect(resolveAuthEntryTarget(false)).toBe("/auth/sign-in");
  });

  it("returns dashboard for authenticated users", () => {
    expect(resolveAuthEntryTarget(true)).toBe("/dashboard");
  });
});

describe("normalizeAuthTab", () => {
  it("defaults to sign-in for empty or invalid values", () => {
    expect(normalizeAuthTab(undefined)).toBe("sign-in");
    expect(normalizeAuthTab(null)).toBe("sign-in");
    expect(normalizeAuthTab("")).toBe("sign-in");
    expect(normalizeAuthTab("invalid")).toBe("sign-in");
  });

  it("keeps supported tab values", () => {
    expect(normalizeAuthTab("sign-in")).toBe("sign-in");
    expect(normalizeAuthTab("sign-up")).toBe("sign-up");
  });

  it("handles array search params", () => {
    expect(normalizeAuthTab(["sign-up"])).toBe("sign-up");
    expect(normalizeAuthTab(["invalid", "sign-up"])).toBe("sign-in");
  });
});

describe("buildAuthTabHref", () => {
  it("sets tab and keeps existing query params", () => {
    const searchParams = new URLSearchParams("foo=1&bar=2");
    expect(buildAuthTabHref("/auth/sign-in", "sign-up", searchParams)).toBe(
      "/auth/sign-in?foo=1&bar=2&tab=sign-up",
    );
  });

  it("replaces existing tab query param", () => {
    const searchParams = new URLSearchParams("tab=sign-in&foo=1");
    expect(buildAuthTabHref("/auth/sign-in", "sign-up", searchParams)).toBe(
      "/auth/sign-in?tab=sign-up&foo=1",
    );
  });
});

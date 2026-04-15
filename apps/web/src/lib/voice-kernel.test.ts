import { describe, expect, it, vi } from "vitest";
import {
  buildInterviewHref,
  buildVoiceKernelHref,
  normalizeVoiceKernel,
  readStoredVoiceKernel,
  resolveVoiceKernelFromSearchParams,
  VOICE_KERNEL_STORAGE_KEY,
  writeStoredVoiceKernel,
} from "@/lib/voice-kernel";

describe("normalizeVoiceKernel", () => {
  it("defaults to stepfun realtime when value is missing or invalid", () => {
    expect(normalizeVoiceKernel(undefined)).toBe("stepfun-realtime");
    expect(normalizeVoiceKernel(null)).toBe("stepfun-realtime");
    expect(normalizeVoiceKernel("")).toBe("stepfun-realtime");
    expect(normalizeVoiceKernel("invalid")).toBe("stepfun-realtime");
  });

  it("supports the explicit stepfun realtime value and migrates old volc values", () => {
    expect(normalizeVoiceKernel("stepfun-realtime")).toBe("stepfun-realtime");
    expect(normalizeVoiceKernel(["stepfun-realtime"])).toBe("stepfun-realtime");
    expect(normalizeVoiceKernel("volc-realtime")).toBe("stepfun-realtime");
  });
});

describe("resolveVoiceKernelFromSearchParams", () => {
  it("prefers the query value when present", () => {
    expect(
      resolveVoiceKernelFromSearchParams({ voiceKernel: "stepfun-realtime" }),
    ).toBe("stepfun-realtime");
  });

  it("falls back to stepfun realtime when query is missing", () => {
    expect(resolveVoiceKernelFromSearchParams({})).toBe("stepfun-realtime");
  });
});

describe("href builders", () => {
  it("builds interview href with voice kernel query", () => {
    expect(buildInterviewHref("interview-1", "stepfun-realtime")).toBe(
      "/interview/interview-1?voiceKernel=stepfun-realtime",
    );
  });

  it("preserves existing params when updating voice kernel", () => {
    const searchParams = new URLSearchParams("foo=1&bar=2");
    expect(
      buildVoiceKernelHref("/interview/abc", "stepfun-realtime", searchParams),
    ).toBe("/interview/abc?foo=1&bar=2&voiceKernel=stepfun-realtime");
  });
});

describe("storage helpers", () => {
  it("reads and writes localStorage", () => {
    const getItem = vi.fn(() => "volc-realtime");
    const setItem = vi.fn();
    vi.stubGlobal("window", {
      localStorage: {
        getItem,
        setItem,
      },
    });

    expect(readStoredVoiceKernel()).toBe("stepfun-realtime");
    writeStoredVoiceKernel("legacy");
    expect(setItem).toHaveBeenCalledWith(VOICE_KERNEL_STORAGE_KEY, "legacy");
  });
});

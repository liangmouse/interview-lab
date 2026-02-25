import { describe, expect, it } from "vitest";
import { resolveDraftTextFromSources } from "./transcription-source-resolver";

describe("resolveDraftTextFromSources", () => {
  it("prefers recent livekit transcription", () => {
    const result = resolveDraftTextFromSources({
      livekitText: "livekit hello",
      livekitUpdatedAt: 10_000,
      browserText: "browser hello",
      now: 10_500,
      livekitPriorityWindowMs: 2_000,
    });

    expect(result).toBe("livekit hello");
  });

  it("falls back to browser transcription when livekit is stale", () => {
    const result = resolveDraftTextFromSources({
      livekitText: "old livekit",
      livekitUpdatedAt: 10_000,
      browserText: "browser fresh",
      now: 13_000,
      livekitPriorityWindowMs: 2_000,
    });

    expect(result).toBe("browser fresh");
  });

  it("ignores browser fallback when browser source is disabled", () => {
    const result = resolveDraftTextFromSources({
      livekitText: "old livekit",
      livekitUpdatedAt: 10_000,
      browserText: "agent voice leaked",
      now: 13_000,
      livekitPriorityWindowMs: 2_000,
      browserFallbackEnabled: false,
    });

    expect(result).toBe("old livekit");
  });
});

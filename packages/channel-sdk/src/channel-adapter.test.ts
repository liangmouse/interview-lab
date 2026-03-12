import { describe, expect, it } from "vitest";
import { degradeOutboundMessage, supportsFeature } from "./channel-adapter";

describe("channel adapter helpers", () => {
  it("degrades unsupported rich content into text-only output", () => {
    const result = degradeOutboundMessage(
      {
        text: "今日学习计划：完成系统设计复盘。",
        card: { title: "学习计划", body: "1. 复盘系统设计\n2. 刷两道题" },
        voice: { text: "要不要我出两道题来测一下？" },
      },
      {
        supportsCards: false,
        supportsVoice: false,
        supportsRichText: false,
      },
    );

    expect(result.card).toBeUndefined();
    expect(result.voice).toBeUndefined();
    expect(result.text).toContain("学习计划");
    expect(result.text).toContain("要不要我出两道题来测一下");
  });

  it("reports capability support correctly", () => {
    expect(
      supportsFeature(
        {
          supportsCards: true,
          supportsVoice: false,
          supportsRichText: true,
        },
        "cards",
      ),
    ).toBe(true);
    expect(
      supportsFeature(
        {
          supportsCards: true,
          supportsVoice: false,
          supportsRichText: true,
        },
        "voice",
      ),
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { extractInlineAudioBase64 } from "./gemini-tts-plugin";
describe("gemini-tts-plugin.extractInlineAudioBase64", () => {
    it("extracts inline base64 audio from first available part", () => {
        const payload = {
            candidates: [
                {
                    content: {
                        parts: [
                            { text: "ignored" },
                            {
                                inlineData: {
                                    mimeType: "audio/L16;codec=pcm;rate=24000",
                                    data: "QUJDRA==",
                                },
                            },
                        ],
                    },
                },
            ],
        };
        expect(extractInlineAudioBase64(payload)).toBe("QUJDRA==");
    });
    it("returns null when no inline audio is present", () => {
        const payload = {
            candidates: [
                {
                    content: {
                        parts: [{ text: "no audio" }],
                    },
                },
            ],
        };
        expect(extractInlineAudioBase64(payload)).toBeNull();
    });
});

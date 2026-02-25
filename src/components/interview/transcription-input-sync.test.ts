import { describe, expect, it } from "vitest";
import { resolveInputTextFromTranscription } from "./transcription-input-sync";

describe("resolveInputTextFromTranscription", () => {
  it("uses transcription text when user has not edited current turn", () => {
    const next = resolveInputTextFromTranscription({
      currentInputText: "manual draft",
      transcriptionText: "hello from mic",
      hasEditedCurrentTurn: false,
    });

    expect(next).toBe("hello from mic");
  });

  it("keeps current input when user has edited current turn", () => {
    const next = resolveInputTextFromTranscription({
      currentInputText: "edited by user",
      transcriptionText: "new mic text",
      hasEditedCurrentTurn: true,
    });

    expect(next).toBe("edited by user");
  });
});

import { describe, expect, it, vi } from "vitest";
import { emitUserTranscription } from "./livekit-turn-mode";

describe("livekit-turn-mode", () => {
  it("emits transcription callback in manual mode", () => {
    const onUserTranscription = vi.fn();
    const onUserTranscriptionRef = { current: onUserTranscription };

    emitUserTranscription({
      onUserTranscriptionRef,
      text: "first",
      isFinal: false,
    });

    expect(onUserTranscription).toHaveBeenCalledTimes(1);
    expect(onUserTranscription).toHaveBeenCalledWith("first", false);
  });

  it("emits transcription callback in vad mode", () => {
    const onUserTranscription = vi.fn();
    const onUserTranscriptionRef = { current: onUserTranscription };

    emitUserTranscription({
      onUserTranscriptionRef,
      text: "second",
      isFinal: true,
    });

    expect(onUserTranscription).toHaveBeenCalledTimes(1);
    expect(onUserTranscription).toHaveBeenCalledWith("second", true);
  });
});

"use client";

import { useCallback } from "react";
import { useLiveKitRoom } from "@/hooks/useLiveKitRoom";
import { useStepfunRealtimeRoom } from "@/hooks/useStepfunRealtimeRoom";
import type {
  InterviewVoiceRuntime,
  InterviewVoiceRuntimeOptions,
} from "./interview-voice-runtime-types";

export function useInterviewVoiceRuntime(
  options: InterviewVoiceRuntimeOptions,
): InterviewVoiceRuntime {
  const legacy = useLiveKitRoom({
    ...options,
    enabled: options.enabled !== false && options.voiceKernel === "legacy",
  });
  const stepfunRealtime = useStepfunRealtimeRoom({
    ...options,
    enabled:
      options.enabled !== false && options.voiceKernel === "stepfun-realtime",
  });

  const legacyStartInterview = useCallback(
    async (args?: { turnMode?: "manual" | "vad" }) => {
      await legacy.sendRpc("start_interview", {
        interviewId: options.interviewId,
        turnMode: args?.turnMode ?? "manual",
      });
    },
    [legacy, options.interviewId],
  );

  if (options.voiceKernel === "stepfun-realtime") {
    return stepfunRealtime;
  }

  return {
    ...legacy,
    voiceKernel: "legacy",
    beginPushToTalk: async () => {},
    endPushToTalk: async () => {},
    startInterview: legacyStartInterview,
  };
}

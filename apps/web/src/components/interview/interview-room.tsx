"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { type AgentState } from "@livekit/components-react";
import { useLocale } from "next-intl";
import { AIInterviewerPanel } from "./ai-interviewer-panel";
import { VoiceFirstPanel } from "./voice-first-panel";
import { CodeWorkbench } from "./code-workbench";
import { InterviewHeader } from "./interview-header";
import { InterviewResumePanel } from "./interview-resume-panel";
import { resolveCodeWorkbenchEvent } from "./code-workbench-event";
import type { CodeProblem } from "./code-editor-utils";
import { resolveDraftTextFromSources } from "./transcription-source-resolver";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useInterviewVoiceRuntime } from "@/hooks/useInterviewVoiceRuntime";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { VoiceKernel } from "@/lib/voice-kernel";
import { writeStoredVoiceKernel } from "@/lib/voice-kernel";
import { useUserStore } from "@/store/user";

interface InterviewRoomProps {
  interviewId: string;
  initialVoiceKernel: VoiceKernel;
}

const TURN_MODE_STORAGE_KEY = "interview-turn-mode";

export function InterviewRoom({
  interviewId,
  initialVoiceKernel,
}: InterviewRoomProps) {
  const locale = useLocale();
  const resumeUrl = useUserStore((state) => state.userInfo?.resume_url ?? null);
  const hasResumeUrl = Boolean(resumeUrl);
  const hasConnectedRef = useRef(false);
  const hasManuallyToggledResumePanelRef = useRef(false);
  const agentEchoCooldownTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const prevIsAgentSpeakingRef = useRef(false);
  const [turnMode] = useState<"manual" | "vad">(() => {
    if (typeof window === "undefined") return "manual";
    const saved = window.localStorage.getItem(TURN_MODE_STORAGE_KEY);
    return saved === "vad" ? "vad" : "manual";
  });
  const [manualDraftText, setManualDraftText] = useState("");
  const [runtimeDraftText, setRuntimeDraftText] = useState("");
  const [isCodeWorkbenchOpen, setIsCodeWorkbenchOpen] = useState(false);
  const [codeProblem, setCodeProblem] = useState<CodeProblem | null>(null);
  const [isResumePanelOpen, setIsResumePanelOpen] = useState(
    () => hasResumeUrl,
  );
  const [isInAgentEchoCooldown, setIsInAgentEchoCooldown] = useState(false);
  const [runtimeDraftUpdatedAt, setRuntimeDraftUpdatedAt] = useState<
    number | null
  >(null);
  const [isPushToTalkPressed, setIsPushToTalkPressed] = useState(false);

  const {
    isSupported: isBrowserSpeechSupported,
    transcript: browserFinalTranscript,
    interimTranscript: browserInterimTranscript,
    startListening,
    stopListening,
    resetTranscript: resetBrowserTranscript,
  } = useSpeechRecognition({
    language: locale.startsWith("zh") ? "zh-CN" : "en-US",
    continuous: true,
    interimResults: true,
    onError: (speechError) => {
      console.warn(
        "[InterviewRoom] Browser speech recognition error:",
        speechError,
      );
    },
  });

  const browserDraftText =
    `${browserFinalTranscript} ${browserInterimTranscript}`.trim();

  const {
    voiceKernel,
    isConnected,
    isConnecting,
    isMicEnabled,
    isAgentSpeaking,
    isUserSpeaking,
    isAudioPlaybackBlocked,
    transcript,
    error,
    connect,
    disconnect,
    toggleMicrophone,
    beginPushToTalk,
    endPushToTalk,
    startInterview,
    sendTextMessage,
  } = useInterviewVoiceRuntime({
    interviewId,
    voiceKernel: initialVoiceKernel,
    onUserTranscription: (text) => {
      setRuntimeDraftText(text);
      setRuntimeDraftUpdatedAt(Date.now());
    },
    onDataMessage: (message) => {
      const event = resolveCodeWorkbenchEvent(message);
      if (event?.action === "open") {
        setCodeProblem(event.problem);
        setIsCodeWorkbenchOpen(true);
      }
      if (event?.action === "close") {
        setIsCodeWorkbenchOpen(false);
      }
    },
    onConnected: () => {
      console.log("[InterviewRoom] Connected to LiveKit room");
    },
    onDisconnected: () => {
      console.log("[InterviewRoom] Disconnected from interview runtime");
    },
    onError: (err) => {
      console.error("[InterviewRoom] Runtime error:", err);
    },
  });
  const shouldUseBrowserFallback = !isAgentSpeaking && !isInAgentEchoCooldown;
  const isVoiceFirstMode = voiceKernel !== "legacy";
  const agentState: AgentState = isConnecting
    ? "connecting"
    : !isConnected
      ? "disconnected"
      : isAgentSpeaking
        ? "speaking"
        : "listening";

  useEffect(() => {
    const nextDraftText = resolveDraftTextFromSources({
      livekitText: runtimeDraftText,
      livekitUpdatedAt: runtimeDraftUpdatedAt,
      browserText: browserDraftText,
      now: Date.now(),
      browserFallbackEnabled: shouldUseBrowserFallback,
    });
    setManualDraftText(nextDraftText);
  }, [
    runtimeDraftText,
    runtimeDraftUpdatedAt,
    browserDraftText,
    shouldUseBrowserFallback,
  ]);

  useEffect(() => {
    writeStoredVoiceKernel(voiceKernel);
  }, [voiceKernel]);

  // 自动连接到房间
  useEffect(() => {
    if (hasConnectedRef.current) return;
    hasConnectedRef.current = true;

    connect();

    return () => {
      disconnect();
    };

    // 只执行一次
  }, [connect, disconnect]);

  // 连接成功后发送 start_interview RPC
  const handleStartInterview = useCallback(async () => {
    if (!isConnected) return;

    try {
      await startInterview({ turnMode });
      console.log("[InterviewRoom] Started interview runtime");
    } catch (err) {
      console.error("[InterviewRoom] Failed to start interview:", err);
    }
  }, [isConnected, startInterview, turnMode]);

  // 发送文本消息
  const handleSendMessage = useCallback(
    async (text: string) => {
      try {
        await sendTextMessage(text);
        setManualDraftText("");
        setRuntimeDraftText("");
        setRuntimeDraftUpdatedAt(null);
        resetBrowserTranscript();
        console.log("[InterviewRoom] Sent text message:", text);
      } catch (err) {
        console.error("[InterviewRoom] Failed to send message:", err);
      }
    },
    [resetBrowserTranscript, sendTextMessage],
  );

  const handleMicToggle = useCallback(() => {
    void (async () => {
      const willEnableMic = !isMicEnabled;
      await toggleMicrophone();

      if (!isBrowserSpeechSupported) return;
      if (willEnableMic && !isAgentSpeaking) {
        startListening();
      } else {
        stopListening();
      }
    })();
  }, [
    isBrowserSpeechSupported,
    isAgentSpeaking,
    isMicEnabled,
    startListening,
    stopListening,
    toggleMicrophone,
  ]);

  const handlePushToTalkStart = useCallback(() => {
    if (!isVoiceFirstMode) return;
    if (!isConnected || isConnecting || isAgentSpeaking) return;

    flushSync(() => {
      setIsPushToTalkPressed(true);
    });
    void beginPushToTalk?.();
  }, [
    beginPushToTalk,
    isAgentSpeaking,
    isConnected,
    isConnecting,
    isVoiceFirstMode,
  ]);

  const handlePushToTalkEnd = useCallback(() => {
    if (!isVoiceFirstMode) return;
    flushSync(() => {
      setIsPushToTalkPressed(false);
    });
    void endPushToTalk?.();
  }, [endPushToTalk, isVoiceFirstMode]);

  useEffect(() => {
    if (!isConnected || !isMicEnabled || isAgentSpeaking) {
      stopListening();
      return;
    }
    if (isInAgentEchoCooldown) {
      stopListening();
      return;
    }
    if (isBrowserSpeechSupported) {
      startListening();
    }
  }, [
    isBrowserSpeechSupported,
    isInAgentEchoCooldown,
    isAgentSpeaking,
    isConnected,
    isMicEnabled,
    startListening,
    stopListening,
  ]);

  useEffect(() => {
    if (!isConnected) {
      if (agentEchoCooldownTimerRef.current) {
        clearTimeout(agentEchoCooldownTimerRef.current);
        agentEchoCooldownTimerRef.current = null;
      }
      setIsInAgentEchoCooldown(false);
      prevIsAgentSpeakingRef.current = false;
      return;
    }

    if (isAgentSpeaking) {
      if (agentEchoCooldownTimerRef.current) {
        clearTimeout(agentEchoCooldownTimerRef.current);
        agentEchoCooldownTimerRef.current = null;
      }
      setIsInAgentEchoCooldown(true);
    } else if (prevIsAgentSpeakingRef.current) {
      if (agentEchoCooldownTimerRef.current) {
        clearTimeout(agentEchoCooldownTimerRef.current);
      }
      agentEchoCooldownTimerRef.current = setTimeout(() => {
        setIsInAgentEchoCooldown(false);
        agentEchoCooldownTimerRef.current = null;
      }, 1500);
    }

    prevIsAgentSpeakingRef.current = isAgentSpeaking;
  }, [isAgentSpeaking, isConnected]);

  useEffect(() => {
    if (!isAgentSpeaking) return;
    resetBrowserTranscript();
  }, [isAgentSpeaking, resetBrowserTranscript]);

  useEffect(() => {
    if (hasResumeUrl && !hasManuallyToggledResumePanelRef.current) {
      setIsResumePanelOpen(true);
    }
  }, [hasResumeUrl]);

  useEffect(() => {
    return () => {
      if (agentEchoCooldownTimerRef.current) {
        clearTimeout(agentEchoCooldownTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isVoiceFirstMode) return;

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      if (
        target.closest(
          'input, textarea, [contenteditable="true"], [role="textbox"], .monaco-editor',
        )
      ) {
        return true;
      }
      return false;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      handlePushToTalkStart();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      handlePushToTalkEnd();
    };

    const handleWindowBlur = () => {
      handlePushToTalkEnd();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [handlePushToTalkEnd, handlePushToTalkStart, isVoiceFirstMode]);

  const handleToggleResumePanel = useCallback(() => {
    hasManuallyToggledResumePanelRef.current = true;
    setIsResumePanelOpen((prev) => !prev);
  }, []);

  // 连接成功后自动开始面试
  useEffect(() => {
    if (isConnected) {
      // 给 Agent 一点时间准备
      const timer = setTimeout(handleStartInterview, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, handleStartInterview]);

  const interviewPanel = isVoiceFirstMode ? (
    <VoiceFirstPanel
      isConnected={isConnected}
      isConnecting={isConnecting}
      isMicEnabled={isMicEnabled}
      isAgentSpeaking={isAgentSpeaking}
      isUserSpeaking={isUserSpeaking}
      isAudioPlaybackBlocked={isAudioPlaybackBlocked}
      transcript={transcript}
      onMicToggle={handleMicToggle}
      manualDraftText={manualDraftText}
      isPushToTalkPressed={isPushToTalkPressed}
      error={error}
      onRetry={connect}
    />
  ) : (
    <AIInterviewerPanel
      turnMode={turnMode}
      isConnected={isConnected}
      isConnecting={isConnecting}
      isMicEnabled={isMicEnabled}
      isAgentSpeaking={isAgentSpeaking}
      agentState={agentState}
      isUserSpeaking={isUserSpeaking}
      isAudioPlaybackBlocked={isAudioPlaybackBlocked}
      transcript={transcript}
      onMicToggle={handleMicToggle}
      manualDraftText={manualDraftText}
      onSendMessage={handleSendMessage}
    />
  );

  const interviewMainContent = !isCodeWorkbenchOpen ? (
    interviewPanel
  ) : (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel minSize={35} defaultSize={48} className="h-full">
        {interviewPanel}
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={52} minSize={30} className="h-full">
        <CodeWorkbench problem={codeProblem ?? undefined} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-[#FDFCF8]">
      <InterviewHeader
        isConnected={isConnected}
        isConnecting={isConnecting}
        error={error}
        isResumePanelOpen={isResumePanelOpen}
        onToggleResumePanel={handleToggleResumePanel}
        isCodeWorkbenchOpen={isCodeWorkbenchOpen}
        onToggleCodeWorkbench={() => {
          setIsCodeWorkbenchOpen((prev) => !prev);
        }}
      />

      <div className="flex-1 overflow-hidden">
        {isResumePanelOpen ? (
          <ResizablePanelGroup direction="horizontal" className="h-full w-full">
            <ResizablePanel minSize={20} defaultSize={34} maxSize={60}>
              <InterviewResumePanel resumeUrl={resumeUrl} />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={66} minSize={40} className="h-full">
              {interviewMainContent}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          interviewMainContent
        )}
      </div>
    </div>
  );
}

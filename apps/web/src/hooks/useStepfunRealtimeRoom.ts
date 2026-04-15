"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addAiMessage,
  addUserMessage,
  getInterviewMessages,
} from "@/action/interview";
import type {
  InterviewVoiceRuntime,
  InterviewVoiceRuntimeOptions,
  InterviewVoiceRuntimeState,
  TranscriptItem,
} from "./interview-voice-runtime-types";

const WS_CONNECTING = "connecting";
const WS_CONNECTED = "connected";
const WS_DISCONNECTED = "disconnected";
const SILENCE_COMMIT_MS = 800;
const MIN_RMS_FOR_SPEECH = 0.014;
const RENDER_PROMPT_PREFIX =
  "你是中文技术面试的语音执行器。请用自然、简洁、像真人面试官的口语表达下面这段话，不要新增事实，不要改变问题核心：\n";

type UseStepfunRealtimeRoomOptions = InterviewVoiceRuntimeOptions;

type StepfunRealtimeSessionResponse = {
  voiceKernel: "stepfun-realtime";
  sessionConfig: {
    transport: "server-relay";
    sessionId: string;
    eventsUrl: string;
    inputUrl: string;
    model: string;
    voice: string;
    inputSampleRate: number;
    outputSampleRate: number;
    instructions: string;
  };
  expiresAt: string;
};

type PendingResponseMetrics = {
  interviewId: string;
  voiceKernel: "stepfun-realtime";
  turnIndex: number;
  questionId: string | null;
  userTranscriptFinal: string;
  assistantTextFinal: string;
  responseStartedAt: number;
  firstAudioAt: number | null;
  responseCompletedAt: number | null;
  interruptCount: number;
  transcriptionSource: "stepfun-realtime";
  assistantTextSource: "existing-interview-core";
};

type PersistedRealtimeState = {
  hasStarted: boolean;
  currentQuestionId: string | null;
  currentQuestionText: string | null;
  turnIndex: number;
};

function storageKey(interviewId: string) {
  return `interview-stepfun-runtime-state:${interviewId}`;
}

function readPersistedRealtimeState(
  interviewId: string,
): PersistedRealtimeState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(interviewId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedRealtimeState>;
    return {
      hasStarted: parsed.hasStarted === true,
      currentQuestionId:
        typeof parsed.currentQuestionId === "string"
          ? parsed.currentQuestionId
          : null,
      currentQuestionText:
        typeof parsed.currentQuestionText === "string"
          ? parsed.currentQuestionText
          : null,
      turnIndex:
        typeof parsed.turnIndex === "number" &&
        Number.isFinite(parsed.turnIndex)
          ? parsed.turnIndex
          : 0,
    };
  } catch {
    return null;
  }
}

function writePersistedRealtimeState(
  interviewId: string,
  value: PersistedRealtimeState,
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(interviewId), JSON.stringify(value));
}

function float32ToBase64Pcm16(input: Float32Array) {
  const pcm = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToFloat32(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const pcm = new Int16Array(bytes.buffer);
  const float = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i += 1) {
    float[i] = pcm[i] / 0x7fff;
  }
  return float;
}

function computeRms(input: Float32Array) {
  if (input.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < input.length; i += 1) {
    total += input[i] * input[i];
  }
  return Math.sqrt(total / input.length);
}

export function useStepfunRealtimeRoom(
  options: UseStepfunRealtimeRoomOptions,
): InterviewVoiceRuntime {
  const {
    interviewId,
    enabled = true,
    onUserTranscription,
    onDataMessage,
    onConnected,
    onDisconnected,
    onError,
  } = options;

  const [state, setState] = useState<InterviewVoiceRuntimeState>({
    connectionState: WS_DISCONNECTED,
    isConnected: false,
    isConnecting: false,
    isMicEnabled: true,
    isAgentSpeaking: false,
    isUserSpeaking: false,
    isAudioPlaybackBlocked: false,
    transcript: [],
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const inputUrlRef = useRef<string | null>(null);
  const pendingInputEventsRef = useRef<Record<string, unknown>[]>([]);
  const inputFlushTimerRef = useRef<number | null>(null);
  const inputFlushPromiseRef = useRef<Promise<void> | null>(null);
  const isFlushingInputRef = useRef(false);
  const activeSessionIdRef = useRef<string | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const playbackNextTimeRef = useRef(0);
  const playbackSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const hasSpeechStartedRef = useRef(false);
  const isCommitPendingRef = useRef(false);
  const lastSpeechAtRef = useRef(0);
  const interruptCountRef = useRef(0);
  const currentQuestionIdRef = useRef<string | null>(null);
  const currentQuestionTextRef = useRef<string | null>(null);
  const turnIndexRef = useRef(0);
  const pushToTalkActiveRef = useRef(false);
  const pushToTalkRestoreMuteRef = useRef(false);
  const pendingResponseMetricsRef = useRef<PendingResponseMetrics | null>(null);
  const historyLoadedRef = useRef(false);
  const hasStartedInterviewRef = useRef(false);
  const connectResolveRef = useRef<(() => void) | null>(null);
  const connectRejectRef = useRef<((error: Error) => void) | null>(null);

  const appendTranscript = useCallback((item: TranscriptItem) => {
    setState((prev) => ({
      ...prev,
      transcript: [...prev.transcript, item],
    }));
  }, []);

  const persistRuntimeState = useCallback(() => {
    writePersistedRealtimeState(interviewId, {
      hasStarted: hasStartedInterviewRef.current,
      currentQuestionId: currentQuestionIdRef.current,
      currentQuestionText: currentQuestionTextRef.current,
      turnIndex: turnIndexRef.current,
    });
  }, [interviewId]);

  const setMicrophoneEnabled = useCallback((enabled: boolean) => {
    setState((prev) => {
      if (prev.isMicEnabled === enabled) return prev;
      return {
        ...prev,
        isMicEnabled: enabled,
      };
    });
  }, []);

  const clearPlaybackQueue = useCallback(() => {
    playbackSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // ignore stop failures for already-ended nodes
      }
      source.disconnect();
    });
    playbackSourcesRef.current.clear();
    const audioContext = playbackAudioContextRef.current;
    if (audioContext) {
      playbackNextTimeRef.current = audioContext.currentTime;
    } else {
      playbackNextTimeRef.current = 0;
    }
  }, []);

  const logMetrics = useCallback((reason: "completed" | "interrupted") => {
    const metrics = pendingResponseMetricsRef.current;
    if (!metrics) return;
    console.info("[stepfun-realtime][turn-metrics]", {
      ...metrics,
      reason,
      userTranscriptLength: metrics.userTranscriptFinal.length,
      assistantTextLength: metrics.assistantTextFinal.length,
      firstAudioLatencyMs:
        metrics.firstAudioAt === null
          ? null
          : metrics.firstAudioAt - metrics.responseStartedAt,
      responseDurationMs:
        metrics.responseCompletedAt === null
          ? null
          : metrics.responseCompletedAt - metrics.responseStartedAt,
    });

    pendingResponseMetricsRef.current = null;
    interruptCountRef.current = 0;
  }, []);

  const finalizePendingResponse = useCallback(
    (reason: "completed" | "interrupted") => {
      const metrics = pendingResponseMetricsRef.current;
      if (!metrics) return;
      metrics.responseCompletedAt = Date.now();
      metrics.interruptCount = interruptCountRef.current;
      setState((prev) => ({
        ...prev,
        isAgentSpeaking: false,
      }));
      clearPlaybackQueue();
      logMetrics(reason);
    },
    [clearPlaybackQueue, logMetrics],
  );

  const sendSocketEvent = useCallback((event: Record<string, unknown>) => {
    if (!inputUrlRef.current) {
      throw new Error("实时语音输入流未建立");
    }
    pendingInputEventsRef.current.push(event);
  }, []);

  const flushPendingInputEvents = useCallback(async () => {
    if (!inputUrlRef.current || isFlushingInputRef.current) {
      return inputFlushPromiseRef.current ?? Promise.resolve();
    }

    isFlushingInputRef.current = true;
    inputFlushPromiseRef.current = (async () => {
      try {
        while (
          pendingInputEventsRef.current.length > 0 &&
          inputUrlRef.current
        ) {
          const inputUrl = inputUrlRef.current;
          const batch = pendingInputEventsRef.current.splice(
            0,
            pendingInputEventsRef.current.length,
          );
          const response = await fetch(inputUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ events: batch }),
          });

          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(data?.error || "写入 StepFun 实时输入失败");
          }
        }
      } finally {
        isFlushingInputRef.current = false;
        inputFlushPromiseRef.current = null;
      }
    })().catch((error) => {
      const normalized =
        error instanceof Error ? error : new Error("StepFun 输入流已断开");
      setState((prev) => ({
        ...prev,
        error: normalized.message,
        isConnected: false,
        isConnecting: false,
        connectionState: WS_DISCONNECTED,
      }));
      onError?.(normalized);
      throw normalized;
    });

    return inputFlushPromiseRef.current;
  }, [onError]);

  const scheduleInputFlush = useCallback(() => {
    if (inputFlushTimerRef.current !== null) return;
    inputFlushTimerRef.current = window.setTimeout(() => {
      inputFlushTimerRef.current = null;
      void flushPendingInputEvents();
    }, 80);
  }, [flushPendingInputEvents]);

  const playAudioChunk = useCallback(
    async (base64Audio: string, sampleRate: number) => {
      if (!playbackAudioContextRef.current) {
        playbackAudioContextRef.current = new AudioContext({ sampleRate });
        playbackNextTimeRef.current =
          playbackAudioContextRef.current.currentTime;
      }

      const audioContext = playbackAudioContextRef.current;
      if (audioContext.state === "suspended") {
        try {
          await audioContext.resume();
        } catch (error) {
          console.warn(
            "[stepfun-realtime] Failed to resume audio context",
            error,
          );
        }
      }

      const channelData = base64ToFloat32(base64Audio);
      const buffer = audioContext.createBuffer(
        1,
        channelData.length,
        sampleRate,
      );
      buffer.copyToChannel(channelData, 0);
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.onended = () => {
        playbackSourcesRef.current.delete(source);
      };

      const now = audioContext.currentTime;
      const startAt =
        playbackNextTimeRef.current > now ? playbackNextTimeRef.current : now;
      if (pendingResponseMetricsRef.current?.firstAudioAt === null) {
        pendingResponseMetricsRef.current.firstAudioAt = Date.now();
      }
      setState((prev) => ({
        ...prev,
        isAgentSpeaking: true,
        isAudioPlaybackBlocked: false,
      }));

      source.start(startAt);
      playbackNextTimeRef.current = startAt + buffer.duration;
      playbackSourcesRef.current.add(source);
    },
    [],
  );

  const fetchRealtimeSession = useCallback(async () => {
    const response = await fetch("/api/interview/realtime/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewId }),
    });

    const data = (await response.json()) as StepfunRealtimeSessionResponse & {
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error || "获取实时语音会话失败");
    }
    return data;
  }, [interviewId]);

  const speakAssistantText = useCallback(
    async (assistantText: string, userTranscriptFinal: string) => {
      const questionId = currentQuestionIdRef.current;
      pendingResponseMetricsRef.current = {
        interviewId,
        voiceKernel: "stepfun-realtime",
        turnIndex: turnIndexRef.current,
        questionId,
        userTranscriptFinal,
        assistantTextFinal: assistantText,
        responseStartedAt: Date.now(),
        firstAudioAt: null,
        responseCompletedAt: null,
        interruptCount: interruptCountRef.current,
        transcriptionSource: "stepfun-realtime",
        assistantTextSource: "existing-interview-core",
      };

      appendTranscript({
        id: `agent-${Date.now()}`,
        role: "agent",
        text: assistantText,
        timestamp: Date.now(),
        isFinal: true,
      });
      await addAiMessage(interviewId, assistantText);

      sendSocketEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${RENDER_PROMPT_PREFIX}${assistantText}`,
            },
          ],
        },
      });
      sendSocketEvent({
        type: "response.create",
        response: {
          modalities: ["text", "audio"],
          instructions:
            "你是中文技术面试官。请忠实、自然地说出用户给出的面试话术，不要新增信息。",
        },
      });
      await flushPendingInputEvents();
    },
    [appendTranscript, flushPendingInputEvents, interviewId, sendSocketEvent],
  );

  const runInitialQuestion = useCallback(async () => {
    const response = await fetch("/api/interview/next-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewId }),
    });
    const data = (await response.json()) as {
      error?: string;
      question?: { questionId: string; questionText: string };
      decision?: { questionText?: string };
    };
    if (!response.ok || !data.question || !data.decision?.questionText) {
      throw new Error(data.error || "初始化面试问题失败");
    }

    currentQuestionIdRef.current = data.question.questionId;
    currentQuestionTextRef.current = data.question.questionText;
    hasStartedInterviewRef.current = true;
    persistRuntimeState();
    await speakAssistantText(data.decision.questionText, "");
  }, [interviewId, persistRuntimeState, speakAssistantText]);

  const processUserFinalText = useCallback(
    async (text: string) => {
      const transcript = text.trim();
      if (!transcript) {
        console.info("[stepfun-realtime][turn-metrics]", {
          interviewId,
          voiceKernel: "stepfun-realtime",
          reason: "missing-final-transcript",
          scorable: false,
        });
        return;
      }

      if (!currentQuestionIdRef.current || !currentQuestionTextRef.current) {
        console.warn(
          "[stepfun-realtime] Missing current question context, skipping score",
        );
        appendTranscript({
          id: `user-${Date.now()}`,
          role: "user",
          text: transcript,
          timestamp: Date.now(),
          isFinal: true,
        });
        onUserTranscription?.(transcript, true);
        return;
      }

      turnIndexRef.current += 1;
      persistRuntimeState();

      appendTranscript({
        id: `user-${Date.now()}`,
        role: "user",
        text: transcript,
        timestamp: Date.now(),
        isFinal: true,
      });
      onUserTranscription?.(transcript, true);
      await addUserMessage(interviewId, transcript);

      const response = await fetch("/api/interview/evaluate-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          questionId: currentQuestionIdRef.current,
          questionText: currentQuestionTextRef.current,
          answer: transcript,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        currentQuestion?: { questionId: string };
        decision?: {
          shouldAdvance?: boolean;
          nextQuestionId?: string;
          questionText?: string;
        };
      };

      if (!response.ok || !data.decision?.questionText) {
        throw new Error(data.error || "处理面试轮次失败");
      }

      currentQuestionIdRef.current =
        data.decision.shouldAdvance && data.decision.nextQuestionId
          ? data.decision.nextQuestionId
          : (data.currentQuestion?.questionId ?? currentQuestionIdRef.current);
      currentQuestionTextRef.current =
        data.decision.questionText || currentQuestionTextRef.current;
      persistRuntimeState();

      await speakAssistantText(data.decision.questionText, transcript);
    },
    [
      appendTranscript,
      interviewId,
      onUserTranscription,
      persistRuntimeState,
      speakAssistantText,
    ],
  );

  const setupMicrophoneCapture = useCallback(
    async (inputSampleRate: number) => {
      if (mediaStreamRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      mediaStreamRef.current = stream;
      inputAudioContextRef.current = new AudioContext({
        sampleRate: inputSampleRate,
      });

      const audioContext = inputAudioContextRef.current;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      mediaSourceRef.current = source;
      processorRef.current = processor;

      processor.onaudioprocess = (event) => {
        if (!enabled || !state.isMicEnabled) return;
        if (!inputUrlRef.current) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const chunk = new Float32Array(inputData);
        const rms = computeRms(chunk);
        const now = Date.now();

        if (rms > MIN_RMS_FOR_SPEECH) {
          hasSpeechStartedRef.current = true;
          lastSpeechAtRef.current = now;
          setState((prev) => ({
            ...prev,
            isUserSpeaking: true,
          }));

          if (pendingResponseMetricsRef.current) {
            interruptCountRef.current += 1;
            pendingResponseMetricsRef.current.interruptCount =
              interruptCountRef.current;
            sendSocketEvent({ type: "response.cancel" });
            void flushPendingInputEvents();
            finalizePendingResponse("interrupted");
          }

          sendSocketEvent({
            type: "input_audio_buffer.append",
            audio: float32ToBase64Pcm16(chunk),
          });
          scheduleInputFlush();
        } else if (
          hasSpeechStartedRef.current &&
          !isCommitPendingRef.current &&
          now - lastSpeechAtRef.current >= SILENCE_COMMIT_MS
        ) {
          isCommitPendingRef.current = true;
          setState((prev) => ({
            ...prev,
            isUserSpeaking: false,
          }));
          sendSocketEvent({ type: "input_audio_buffer.commit" });
          void flushPendingInputEvents();
          hasSpeechStartedRef.current = false;
          window.setTimeout(() => {
            isCommitPendingRef.current = false;
          }, 120);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    },
    [
      enabled,
      finalizePendingResponse,
      flushPendingInputEvents,
      scheduleInputFlush,
      sendSocketEvent,
      state.isMicEnabled,
    ],
  );

  const startRealtimeInputStream = useCallback((inputUrl: string) => {
    inputUrlRef.current = inputUrl;
    pendingInputEventsRef.current = [];
  }, []);

  const teardownRealtimeResources = useCallback(async () => {
    clearPlaybackQueue();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (mediaSourceRef.current) {
      mediaSourceRef.current.disconnect();
      mediaSourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      await inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (playbackAudioContextRef.current) {
      await playbackAudioContextRef.current.close();
      playbackAudioContextRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (inputFlushTimerRef.current !== null) {
      window.clearTimeout(inputFlushTimerRef.current);
      inputFlushTimerRef.current = null;
    }
    await flushPendingInputEvents().catch(() => undefined);
    pendingInputEventsRef.current = [];
    inputUrlRef.current = null;

    const sessionId = activeSessionIdRef.current;
    activeSessionIdRef.current = null;
    if (sessionId) {
      await fetch(
        `/api/interview/realtime/session?sessionId=${encodeURIComponent(sessionId)}`,
        { method: "DELETE" },
      ).catch(() => undefined);
    }
  }, [clearPlaybackQueue, flushPendingInputEvents]);

  useEffect(() => {
    if (!enabled || !interviewId || historyLoadedRef.current) return;

    let mounted = true;
    const loadHistory = async () => {
      try {
        const { success, messages } = await getInterviewMessages(interviewId);
        if (!success || !messages || !mounted) return;

        const history: TranscriptItem[] = [];
        if (Array.isArray(messages.user_messages)) {
          messages.user_messages.forEach((msg: any) => {
            history.push({
              id: msg.id || `hist-user-${Date.now()}-${Math.random()}`,
              role: "user",
              text: msg.content,
              timestamp: new Date(msg.timestamp).getTime(),
              isFinal: true,
            });
          });
        }
        if (Array.isArray(messages.ai_messages)) {
          messages.ai_messages.forEach((msg: any) => {
            history.push({
              id: msg.id || `hist-ai-${Date.now()}-${Math.random()}`,
              role: "agent",
              text: msg.content,
              timestamp: new Date(msg.timestamp).getTime(),
              isFinal: true,
            });
          });
        }
        history.sort((left, right) => left.timestamp - right.timestamp);
        historyLoadedRef.current = true;
        setState((prev) => ({ ...prev, transcript: history }));
      } catch (error) {
        console.error("[stepfun-realtime] Failed to load history", error);
      }
    };

    void loadHistory();
    return () => {
      mounted = false;
    };
  }, [enabled, interviewId]);

  const handleRealtimeMessage = useCallback(
    async (
      message: Record<string, unknown>,
      outputSampleRate: number,
      expiresAt: string,
    ) => {
      onDataMessage?.(message);

      if (
        message.type === "session.created" ||
        message.type === "session.updated"
      ) {
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          isConnected: true,
          connectionState: WS_CONNECTED,
        }));
        connectResolveRef.current?.();
        connectResolveRef.current = null;
        connectRejectRef.current = null;
      }

      if (message.type === "relay.error") {
        const relayMessage = String(
          (message.error as { message?: string } | undefined)?.message ||
            "StepFun relay 出错",
        );
        const error = new Error(relayMessage);
        connectRejectRef.current?.(error);
        connectRejectRef.current = null;
        connectResolveRef.current = null;
        throw error;
      }

      if (message.type === "relay.closed") {
        setState((prev) => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          connectionState: WS_DISCONNECTED,
          isAgentSpeaking: false,
          isUserSpeaking: false,
        }));
        onDisconnected?.();
        return;
      }

      if (
        message.type === "conversation.item.input_audio_transcription.completed"
      ) {
        const transcript = String(message.transcript || "").trim();
        if (transcript) {
          await processUserFinalText(transcript);
        } else {
          console.info("[stepfun-realtime][turn-metrics]", {
            interviewId,
            voiceKernel: "stepfun-realtime",
            reason: "missing-final-transcript",
            scorable: false,
          });
        }
      }

      if (message.type === "response.audio.delta" && message.delta) {
        await playAudioChunk(String(message.delta), outputSampleRate);
      }

      if (
        message.type === "response.audio.done" ||
        message.type === "response.done"
      ) {
        finalizePendingResponse("completed");
      }

      if (
        message.type === "session.created" ||
        message.type === "session.updated"
      ) {
        console.info("[stepfun-realtime][session]", {
          interviewId,
          voiceKernel: "stepfun-realtime",
          status: "connected",
          expiresAt,
        });
      }
    },
    [
      finalizePendingResponse,
      interviewId,
      onDataMessage,
      onDisconnected,
      playAudioChunk,
      processUserFinalText,
    ],
  );

  const connect = useCallback(async () => {
    if (!enabled) return;
    if (eventSourceRef.current) return;

    setState((prev) => ({
      ...prev,
      isConnecting: true,
      error: null,
      connectionState: WS_CONNECTING,
    }));

    try {
      const session = await fetchRealtimeSession();
      activeSessionIdRef.current = session.sessionConfig.sessionId;
      startRealtimeInputStream(session.sessionConfig.inputUrl);
      await setupMicrophoneCapture(session.sessionConfig.inputSampleRate);

      const connectReady = new Promise<void>((resolve, reject) => {
        connectResolveRef.current = resolve;
        connectRejectRef.current = reject;
        window.setTimeout(() => {
          if (!connectResolveRef.current) return;
          connectRejectRef.current?.(new Error("StepFun 连接握手超时"));
          connectResolveRef.current = null;
          connectRejectRef.current = null;
        }, 10_000);
      });

      const eventSource = new EventSource(session.sessionConfig.eventsUrl);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        void (async () => {
          const message = JSON.parse(event.data) as Record<string, unknown>;
          await handleRealtimeMessage(
            message,
            session.sessionConfig.outputSampleRate,
            session.expiresAt,
          );
        })().catch((error) => {
          const normalized =
            error instanceof Error ? error : new Error("处理 StepFun 事件失败");
          setState((prev) => ({
            ...prev,
            isConnecting: false,
            isConnected: false,
            connectionState: WS_DISCONNECTED,
            error: normalized.message,
          }));
          onError?.(normalized);
        });
      };

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;
        const error = new Error("StepFun 事件流连接失败");
        connectRejectRef.current?.(error);
        connectRejectRef.current = null;
        connectResolveRef.current = null;
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          isConnected: false,
          connectionState: WS_DISCONNECTED,
          error: error.message,
        }));
        onError?.(error);
      };

      sendSocketEvent({
        type: "session.update",
        session: {
          modalities: ["text", "audio"],
          instructions: session.sessionConfig.instructions,
          voice: session.sessionConfig.voice,
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
        },
      });
      await flushPendingInputEvents();

      const persisted = readPersistedRealtimeState(interviewId);
      if (persisted) {
        hasStartedInterviewRef.current = persisted.hasStarted;
        currentQuestionIdRef.current = persisted.currentQuestionId;
        currentQuestionTextRef.current = persisted.currentQuestionText;
        turnIndexRef.current = persisted.turnIndex;
      }

      await connectReady;
      onConnected?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "连接实时语音会话失败";
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        isConnected: false,
        connectionState: WS_DISCONNECTED,
        error: message,
      }));
      await teardownRealtimeResources();
      onError?.(error instanceof Error ? error : new Error(message));
    }
  }, [
    enabled,
    fetchRealtimeSession,
    handleRealtimeMessage,
    interviewId,
    onConnected,
    onError,
    flushPendingInputEvents,
    sendSocketEvent,
    setupMicrophoneCapture,
    startRealtimeInputStream,
    teardownRealtimeResources,
  ]);

  const disconnect = useCallback(async () => {
    if (!enabled) return;
    await teardownRealtimeResources();
    setState((prev) => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      connectionState: WS_DISCONNECTED,
      isAgentSpeaking: false,
      isUserSpeaking: false,
    }));
    console.info("[stepfun-realtime][session]", {
      interviewId,
      voiceKernel: "stepfun-realtime",
      status: "disconnected",
      totalTurns: turnIndexRef.current,
      reportReady: turnIndexRef.current > 0,
    });
    onDisconnected?.();
  }, [enabled, interviewId, onDisconnected, teardownRealtimeResources]);

  const toggleMicrophone = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isMicEnabled: !prev.isMicEnabled,
    }));
  }, []);

  const beginPushToTalk = useCallback(async () => {
    if (!enabled) return;
    if (!state.isConnected || state.isConnecting || state.isAgentSpeaking)
      return;
    if (pushToTalkActiveRef.current) return;

    pushToTalkActiveRef.current = true;
    pushToTalkRestoreMuteRef.current = !state.isMicEnabled;
    hasSpeechStartedRef.current = false;
    isCommitPendingRef.current = false;
    lastSpeechAtRef.current = 0;

    if (!state.isMicEnabled) {
      setMicrophoneEnabled(true);
    }

    setState((prev) => ({
      ...prev,
      isUserSpeaking: true,
    }));
  }, [
    enabled,
    setMicrophoneEnabled,
    state.isAgentSpeaking,
    state.isConnected,
    state.isConnecting,
    state.isMicEnabled,
  ]);

  const endPushToTalk = useCallback(async () => {
    if (!enabled) return;
    if (!pushToTalkActiveRef.current) return;

    pushToTalkActiveRef.current = false;
    setState((prev) => ({
      ...prev,
      isUserSpeaking: false,
    }));

    if (
      inputUrlRef.current &&
      !isCommitPendingRef.current &&
      (hasSpeechStartedRef.current || lastSpeechAtRef.current > 0)
    ) {
      isCommitPendingRef.current = true;
      sendSocketEvent({ type: "input_audio_buffer.commit" });
      await flushPendingInputEvents();
      hasSpeechStartedRef.current = false;
      lastSpeechAtRef.current = 0;
      window.setTimeout(() => {
        isCommitPendingRef.current = false;
      }, 120);
    }

    if (pushToTalkRestoreMuteRef.current) {
      pushToTalkRestoreMuteRef.current = false;
      setMicrophoneEnabled(false);
    }
  }, [enabled, flushPendingInputEvents, sendSocketEvent, setMicrophoneEnabled]);

  const startInterview = useCallback(async () => {
    if (!enabled) return;
    if (hasStartedInterviewRef.current) {
      console.info("[stepfun-realtime][session]", {
        interviewId,
        voiceKernel: "stepfun-realtime",
        status: "resume",
        currentQuestionId: currentQuestionIdRef.current,
      });
      return;
    }
    await runInitialQuestion();
  }, [enabled, interviewId, runInitialQuestion]);

  const sendTextMessage = useCallback(
    async (text: string) => {
      if (!enabled) return;
      if (!text.trim()) return;
      if (pendingResponseMetricsRef.current) {
        sendSocketEvent({ type: "response.cancel" });
        await flushPendingInputEvents();
        finalizePendingResponse("interrupted");
      }
      await processUserFinalText(text);
    },
    [
      enabled,
      finalizePendingResponse,
      flushPendingInputEvents,
      processUserFinalText,
      sendSocketEvent,
    ],
  );

  useEffect(() => {
    return () => {
      void teardownRealtimeResources();
    };
  }, [teardownRealtimeResources]);

  return useMemo(
    () => ({
      ...state,
      voiceKernel: "stepfun-realtime",
      connect,
      disconnect,
      toggleMicrophone,
      beginPushToTalk,
      endPushToTalk,
      startInterview,
      sendTextMessage,
    }),
    [
      beginPushToTalk,
      connect,
      disconnect,
      endPushToTalk,
      sendTextMessage,
      startInterview,
      state,
      toggleMicrophone,
    ],
  );
}

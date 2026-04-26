"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ServerEventId,
  decodeFrame,
  encodeFinishConnection,
  encodeFinishSession,
  encodeStartConnection,
  encodeStartSession,
  encodeTaskRequest,
} from "@interviewclaw/volc-realtime-protocol";

type ConnectionState =
  | "idle"
  | "connecting"
  | "session-starting"
  | "ready"
  | "closing"
  | "closed"
  | "error";

type TranscriptRole = "user" | "assistant";

export type RealtimeTranscriptItem = {
  id: string;
  role: TranscriptRole;
  text: string;
  final: boolean;
};

export type RealtimeVoiceDiagnostics = {
  sessionId: string | null;
  gatewayUrl: string | null;
  gatewayHost: string | null;
  connectId: string | null;
  state: ConnectionState;
  audioFramesSent: number;
  audioBytesSent: number;
  audioFramesReceived: number;
  audioBytesReceived: number;
  serverEvents: number;
  transcriptFinals: number;
  persistedMessages: number;
  persistFailures: number;
  ttsInterruptions: number;
  pendingTtsSources: number;
  lastEvent: string | null;
  lastGatewayEvent: string | null;
  lastCloseCode: number | null;
  lastCloseReason: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

type GatewayDiagnosticEvent = {
  type: "gateway_diagnostic";
  event: string;
  connectId: string;
  at: string;
  detail?: Record<string, unknown>;
};

type UseRealtimeVoiceOptions = {
  interviewId?: string;
  systemRole?: string;
  speakingStyle?: string;
  botName?: string;
  speaker?: string;
  onTranscriptFinal?: (item: RealtimeTranscriptItem) => void;
};

type RealtimeVoiceApi = {
  state: ConnectionState;
  transcript: RealtimeTranscriptItem[];
  diagnostics: RealtimeVoiceDiagnostics;
  micLevel: number;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

const OUTPUT_SAMPLE_RATE = 24000;
const INPUT_SAMPLE_RATE = 16000;
const SERVER_EVENT_NAMES = Object.fromEntries(
  Object.entries(ServerEventId).map(([name, id]) => [id, name]),
) as Record<number, string>;

function createInitialDiagnostics(): RealtimeVoiceDiagnostics {
  return {
    sessionId: null,
    gatewayUrl: null,
    gatewayHost: null,
    connectId: null,
    state: "idle",
    audioFramesSent: 0,
    audioBytesSent: 0,
    audioFramesReceived: 0,
    audioBytesReceived: 0,
    serverEvents: 0,
    transcriptFinals: 0,
    persistedMessages: 0,
    persistFailures: 0,
    ttsInterruptions: 0,
    pendingTtsSources: 0,
    lastEvent: null,
    lastGatewayEvent: null,
    lastCloseCode: null,
    lastCloseReason: null,
    lastError: null,
    updatedAt: null,
  };
}

async function fetchSession(): Promise<{ token: string; gatewayUrl: string }> {
  const res = await fetch("/api/voice/realtime/session", { cache: "no-store" });
  if (!res.ok) {
    let message = `session_fetch_failed_${res.status}`;
    try {
      const data = (await res.json()) as {
        error?: string;
        missingEnv?: string[];
      };
      if (data.error) {
        message = data.error;
      }
      if (data.missingEnv?.length) {
        message = `${message}。请在 .env.local 中配置: ${data.missingEnv.join(", ")}`;
      }
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(message);
  }
  const data = (await res.json()) as {
    token?: string;
    gatewayUrl?: string;
    error?: string;
  };
  if (!data.token || !data.gatewayUrl) {
    throw new Error(data.error ?? "session_invalid");
  }
  return { token: data.token, gatewayUrl: data.gatewayUrl };
}

function getGatewayLabel(gatewayUrl: string) {
  try {
    const url = new URL(gatewayUrl);
    return url.host;
  } catch {
    return gatewayUrl;
  }
}

function describeWsClose(
  ev: CloseEvent,
  gatewayLabel: string,
  opened: boolean,
) {
  if (!opened && ev.code === 1006) {
    return `无法连接实时语音网关（${gatewayLabel}）。请确认已启动 pnpm dev:gateway 或 pnpm dev:realtime。`;
  }
  if (ev.code === 1006) {
    return `实时语音网关异常断开（${gatewayLabel}）。请查看 gateway 终端日志。`;
  }
  if (ev.code === 1005) {
    return `实时语音连接关闭但没有收到关闭原因（${gatewayLabel}）。请查看诊断面板里的 connectId，并对照 gateway 终端日志。`;
  }
  if (ev.code === 1011 && ev.reason === "server_misconfigured") {
    return "实时语音 gateway 缺少火山环境变量，请检查 VOLCENGINE_STT_APP_ID 和 VOLCENGINE_STT_ACCESS_TOKEN。";
  }
  if (ev.code === 1011 && ev.reason.startsWith("upstream_closed_")) {
    return `火山实时语音上游连接关闭（${ev.reason}）。请查看 gateway 终端里的 upstream_closed 日志。`;
  }
  if (ev.code === 1011 && ev.reason.startsWith("upstream_http_")) {
    return `火山实时语音握手失败（${ev.reason}）。请检查 APP-ID / Access-Key / Resource-Id，并查看 gateway 终端日志里的 x-tt-logid。`;
  }
  return `实时语音连接已关闭 ${ev.code}${ev.reason ? `: ${ev.reason}` : ""}`;
}

async function persistRealtimeMessage(input: {
  interviewId: string;
  role: TranscriptRole;
  content: string;
}) {
  const response = await fetch("/api/interview/messages", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      interviewId: input.interviewId,
      role: input.role,
      content: input.content,
    }),
  });

  if (!response.ok) {
    let message = `persist_failed_${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // Keep status-based message.
    }
    throw new Error(message);
  }
}

function buildStartSessionPayload(opts: UseRealtimeVoiceOptions) {
  return {
    tts: {
      audio_config: {
        channel: 1,
        format: "pcm_s16le",
        sample_rate: OUTPUT_SAMPLE_RATE,
      },
      ...(opts.speaker ? { speaker: opts.speaker } : {}),
    },
    dialog: {
      ...(opts.botName ? { bot_name: opts.botName } : {}),
      ...(opts.systemRole ? { system_role: opts.systemRole } : {}),
      ...(opts.speakingStyle ? { speaking_style: opts.speakingStyle } : {}),
      extra: {
        input_mod: "keep_alive",
        // O2.0 model. See Volcengine doc 1594356 §2.3 StartSession.
        model: "1.2.1.1",
      },
    },
  };
}

class PcmQueuePlayer {
  private ctx: AudioContext | null = null;
  private nextStartAt = 0;
  private sources = new Set<AudioBufferSourceNode>();

  async start() {
    if (this.ctx) return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new AC({ sampleRate: OUTPUT_SAMPLE_RATE });
    this.nextStartAt = this.ctx.currentTime;
  }

  enqueue(pcm: Uint8Array) {
    if (!this.ctx) return;
    const sampleCount = Math.floor(pcm.byteLength / 2);
    if (sampleCount <= 0) return;
    const buffer = this.ctx.createBuffer(1, sampleCount, OUTPUT_SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    for (let i = 0; i < sampleCount; i += 1) {
      const s = view.getInt16(i * 2, true);
      channel[i] = s < 0 ? s / 0x8000 : s / 0x7fff;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
    };
    const startAt = Math.max(this.nextStartAt, this.ctx.currentTime);
    source.start(startAt);
    this.nextStartAt = startAt + buffer.duration;
  }

  clear() {
    if (!this.ctx) return;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
      this.sources.delete(source);
    }
    this.nextStartAt = this.ctx.currentTime;
  }

  getPendingSourceCount() {
    return this.sources.size;
  }

  async stop() {
    if (!this.ctx) return;
    this.clear();
    await this.ctx.close().catch(() => undefined);
    this.ctx = null;
  }
}

export function useRealtimeVoice(
  options: UseRealtimeVoiceOptions = {},
): RealtimeVoiceApi {
  const [state, setState] = useState<ConnectionState>("idle");
  const [transcript, setTranscript] = useState<RealtimeTranscriptItem[]>([]);
  const [diagnostics, setDiagnostics] = useState<RealtimeVoiceDiagnostics>(
    createInitialDiagnostics,
  );
  const [micLevel, setMicLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef<ConnectionState>("idle");
  const diagnosticsRef = useRef<RealtimeVoiceDiagnostics>(
    createInitialDiagnostics(),
  );
  const diagnosticsTimerRef = useRef<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const playerRef = useRef<PcmQueuePlayer | null>(null);
  const pendingUserRef = useRef<{ id: string; text: string } | null>(null);
  const pendingAssistantRef = useRef<{ id: string; text: string } | null>(null);
  const persistedMessageIdsRef = useRef<Set<string>>(new Set());
  const optsRef = useRef(options);
  optsRef.current = options;

  const publishDiagnostics = useCallback(() => {
    setDiagnostics({ ...diagnosticsRef.current });
  }, []);

  const patchDiagnostics = useCallback(
    (patch: Partial<RealtimeVoiceDiagnostics>, publish = true) => {
      diagnosticsRef.current = {
        ...diagnosticsRef.current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      if (publish) publishDiagnostics();
    },
    [publishDiagnostics],
  );

  const scheduleDiagnosticsPublish = useCallback(() => {
    if (diagnosticsTimerRef.current !== null) return;
    diagnosticsTimerRef.current = window.setTimeout(() => {
      diagnosticsTimerRef.current = null;
      publishDiagnostics();
    }, 500);
  }, [publishDiagnostics]);

  const setConnectionState = useCallback(
    (
      next: ConnectionState | ((current: ConnectionState) => ConnectionState),
    ) => {
      const resolved =
        typeof next === "function" ? next(stateRef.current) : next;
      stateRef.current = resolved;
      patchDiagnostics({ state: resolved }, true);
      setState(resolved);
    },
    [patchDiagnostics],
  );

  const appendTranscript = useCallback(
    (role: TranscriptRole, text: string, final: boolean, id: string) => {
      setTranscript((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx >= 0) {
          const copy = prev.slice();
          copy[idx] = { ...copy[idx], text, final };
          return copy;
        }
        return [...prev, { id, role, text, final }];
      });
    },
    [],
  );

  const persistFinalTranscript = useCallback(
    (item: RealtimeTranscriptItem) => {
      const content = item.text.trim();
      if (!content || persistedMessageIdsRef.current.has(item.id)) return;

      persistedMessageIdsRef.current.add(item.id);
      optsRef.current.onTranscriptFinal?.(item);
      patchDiagnostics({
        transcriptFinals: diagnosticsRef.current.transcriptFinals + 1,
      });

      const interviewId = optsRef.current.interviewId;
      if (!interviewId) return;

      void persistRealtimeMessage({
        interviewId,
        role: item.role,
        content,
      })
        .then(() => {
          patchDiagnostics({
            persistedMessages: diagnosticsRef.current.persistedMessages + 1,
          });
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.warn("[volc] persist transcript failed", message);
          patchDiagnostics({
            persistFailures: diagnosticsRef.current.persistFailures + 1,
            lastError: `persist: ${message}`,
          });
        });
    },
    [patchDiagnostics],
  );

  const finalizeTranscript = useCallback(
    (role: TranscriptRole, text: string, id: string) => {
      const item: RealtimeTranscriptItem = { id, role, text, final: true };
      appendTranscript(role, text, true, id);
      persistFinalTranscript(item);
    },
    [appendTranscript, persistFinalTranscript],
  );

  const interruptPlayback = useCallback(
    (reason: string) => {
      const player = playerRef.current;
      if (!player) return;
      player.clear();
      patchDiagnostics({
        ttsInterruptions: diagnosticsRef.current.ttsInterruptions + 1,
        pendingTtsSources: player.getPendingSourceCount(),
        lastEvent: `playback_interrupted:${reason}`,
      });
    },
    [patchDiagnostics],
  );

  const handleGatewayDiagnostic = useCallback(
    (data: string) => {
      try {
        const event = JSON.parse(data) as GatewayDiagnosticEvent;
        if (event.type !== "gateway_diagnostic") return;
        patchDiagnostics({
          connectId: event.connectId,
          lastGatewayEvent: event.event,
          lastEvent: `gateway:${event.event}`,
        });
      } catch {
        // Ignore non-diagnostic text frames.
      }
    },
    [patchDiagnostics],
  );

  const handleServerFrame = useCallback(
    (data: ArrayBuffer) => {
      const parsed = decodeFrame(data);
      const eventName =
        "eventId" in parsed
          ? (SERVER_EVENT_NAMES[parsed.eventId] ?? `${parsed.eventId}`)
          : parsed.kind;
      patchDiagnostics({
        audioFramesReceived:
          parsed.kind === "server-audio"
            ? diagnosticsRef.current.audioFramesReceived + 1
            : diagnosticsRef.current.audioFramesReceived,
        audioBytesReceived:
          parsed.kind === "server-audio"
            ? diagnosticsRef.current.audioBytesReceived + data.byteLength
            : diagnosticsRef.current.audioBytesReceived,
        serverEvents:
          parsed.kind === "server-json" || parsed.kind === "server-audio"
            ? diagnosticsRef.current.serverEvents + 1
            : diagnosticsRef.current.serverEvents,
        lastEvent: eventName,
      });
      if (parsed.kind === "error") {
        console.error("[volc] error frame:", parsed);
        setError(`volc_error ${parsed.code}: ${parsed.message}`);
        patchDiagnostics({
          lastError: `volc_error ${parsed.code}: ${parsed.message}`,
        });
        return;
      }
      if (parsed.kind === "server-audio") {
        if (parsed.eventId === ServerEventId.TTSResponse) {
          playerRef.current?.enqueue(parsed.audio);
          patchDiagnostics(
            {
              pendingTtsSources:
                playerRef.current?.getPendingSourceCount() ?? 0,
            },
            false,
          );
          scheduleDiagnosticsPublish();
        }
        return;
      }
      const { eventId, json } = parsed;
      const payload = (json ?? {}) as Record<string, unknown>;

      switch (eventId) {
        case ServerEventId.ConnectionStarted: {
          // Connection open; move on to StartSession. Handled in start() flow.
          break;
        }
        case ServerEventId.SessionStarted: {
          setConnectionState("ready");
          break;
        }
        case ServerEventId.ASRInfo: {
          const qid = String(payload.question_id ?? `user-${Date.now()}`);
          pendingUserRef.current = { id: qid, text: "" };
          interruptPlayback("asr_info");
          break;
        }
        case ServerEventId.ASRResponse: {
          const results = payload.results as
            | Array<{ alternatives?: Array<{ text?: string }> }>
            | undefined;
          const text =
            (payload.text as string | undefined) ??
            results?.[0]?.alternatives?.[0]?.text ??
            "";
          const pending = pendingUserRef.current;
          if (pending) {
            pending.text = text;
            appendTranscript("user", text, false, pending.id);
          }
          break;
        }
        case ServerEventId.ASREnded: {
          const pending = pendingUserRef.current;
          if (pending) {
            finalizeTranscript("user", pending.text, pending.id);
            pendingUserRef.current = null;
          }
          break;
        }
        case ServerEventId.ChatResponse: {
          const rid = String(payload.reply_id ?? `asst-${Date.now()}`);
          const delta = (payload.content as string | undefined) ?? "";
          const pending = pendingAssistantRef.current;
          const next =
            pending && pending.id === rid
              ? { id: rid, text: pending.text + delta }
              : { id: rid, text: delta };
          pendingAssistantRef.current = next;
          appendTranscript("assistant", next.text, false, rid);
          break;
        }
        case ServerEventId.ChatEnded: {
          const pending = pendingAssistantRef.current;
          if (pending) {
            finalizeTranscript("assistant", pending.text, pending.id);
            pendingAssistantRef.current = null;
          }
          break;
        }
        case ServerEventId.TTSEnded: {
          break;
        }
        case ServerEventId.SessionFailed:
        case ServerEventId.ConnectionFailed: {
          setError(JSON.stringify(payload));
          patchDiagnostics({ lastError: JSON.stringify(payload) });
          setConnectionState("error");
          break;
        }
        default:
          break;
      }
    },
    [
      appendTranscript,
      finalizeTranscript,
      handleGatewayDiagnostic,
      interruptPlayback,
      patchDiagnostics,
      scheduleDiagnosticsPublish,
      setConnectionState,
    ],
  );

  const stop = useCallback(async () => {
    setConnectionState((s) => (s === "idle" || s === "closed" ? s : "closing"));

    const ws = wsRef.current;
    const sid = sessionIdRef.current;
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        if (sid) ws.send(encodeFinishSession(sid));
        ws.send(encodeFinishConnection());
      }
    } catch (err) {
      console.warn("[volc] finish send failed", err);
    }

    try {
      workletNodeRef.current?.disconnect();
    } catch {}
    workletNodeRef.current = null;

    if (micStreamRef.current) {
      for (const track of micStreamRef.current.getTracks()) track.stop();
      micStreamRef.current = null;
    }
    if (inputCtxRef.current) {
      await inputCtxRef.current.close().catch(() => undefined);
      inputCtxRef.current = null;
    }
    if (playerRef.current) {
      await playerRef.current.stop();
      playerRef.current = null;
    }
    if (ws && ws.readyState <= WebSocket.OPEN) {
      ws.close();
    }
    wsRef.current = null;
    sessionIdRef.current = null;
    patchDiagnostics({
      sessionId: null,
      pendingTtsSources: 0,
    });
    setConnectionState("closed");
    setMicLevel(0);
  }, [patchDiagnostics, setConnectionState]);

  const start = useCallback(async () => {
    const currentState = stateRef.current;
    if (
      currentState === "connecting" ||
      currentState === "ready" ||
      currentState === "session-starting"
    ) {
      return;
    }
    setError(null);
    setTranscript([]);
    persistedMessageIdsRef.current.clear();
    diagnosticsRef.current = createInitialDiagnostics();
    setDiagnostics(diagnosticsRef.current);
    setConnectionState("connecting");

    let session: { token: string; gatewayUrl: string };
    try {
      session = await fetchSession();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setConnectionState("error");
      return;
    }

    const url = `${session.gatewayUrl}?token=${encodeURIComponent(session.token)}`;
    const gatewayLabel = getGatewayLabel(session.gatewayUrl);
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;
    let wsOpened = false;

    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    sessionIdRef.current = sessionId;
    patchDiagnostics({
      gatewayUrl: session.gatewayUrl,
      gatewayHost: gatewayLabel,
      sessionId,
    });

    ws.onopen = () => {
      wsOpened = true;
      ws.send(encodeStartConnection());
      setConnectionState("session-starting");
      ws.send(
        encodeStartSession(
          sessionId,
          buildStartSessionPayload(optsRef.current),
        ),
      );
    };

    ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        handleServerFrame(ev.data);
      } else if (ev.data instanceof Blob) {
        ev.data
          .arrayBuffer()
          .then(handleServerFrame)
          .catch(() => undefined);
      } else if (typeof ev.data === "string") {
        handleGatewayDiagnostic(ev.data);
      }
    };

    ws.onerror = () => {
      const message = `实时语音网关连接失败（${gatewayLabel}）。请确认 gateway 正在运行，并检查 gateway 终端日志。`;
      setError(message);
      patchDiagnostics({ lastError: message });
      setConnectionState("error");
    };

    ws.onclose = (ev) => {
      patchDiagnostics({
        lastCloseCode: ev.code,
        lastCloseReason: ev.reason || null,
      });
      if (stateRef.current !== "closing") {
        const message = describeWsClose(ev, gatewayLabel, wsOpened);
        setError((prev) => prev ?? message);
        patchDiagnostics({ lastError: message });
      }
      setConnectionState((s) =>
        s === "closing" ? "closed" : s === "error" ? "error" : "closed",
      );
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
        },
      });
      micStreamRef.current = stream;

      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const inputCtx = new AC({ sampleRate: INPUT_SAMPLE_RATE });
      inputCtxRef.current = inputCtx;
      await inputCtx.audioWorklet.addModule(
        "/audio-worklet/volc-pcm-recorder.js",
      );

      const source = inputCtx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(inputCtx, "volc-pcm-recorder");
      workletNodeRef.current = node;

      node.port.onmessage = (event: MessageEvent) => {
        const data = event.data as { pcm: ArrayBuffer; rms: number };
        setMicLevel(data.rms);
        if (ws.readyState !== WebSocket.OPEN) return;
        if (stateRef.current !== "ready") return;
        const sid = sessionIdRef.current;
        if (!sid) return;
        const frame = encodeTaskRequest(sid, new Uint8Array(data.pcm));
        ws.send(frame);
        patchDiagnostics(
          {
            audioFramesSent: diagnosticsRef.current.audioFramesSent + 1,
            audioBytesSent:
              diagnosticsRef.current.audioBytesSent + frame.byteLength,
          },
          false,
        );
        scheduleDiagnosticsPublish();
      };
      source.connect(node);

      const player = new PcmQueuePlayer();
      await player.start();
      playerRef.current = player;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await stop();
      setError(`mic_error: ${msg}`);
      patchDiagnostics({ lastError: `mic_error: ${msg}` });
      setConnectionState("error");
    }
  }, [
    handleGatewayDiagnostic,
    handleServerFrame,
    patchDiagnostics,
    scheduleDiagnosticsPublish,
    setConnectionState,
    stop,
  ]);

  useEffect(() => {
    return () => {
      if (diagnosticsTimerRef.current !== null) {
        window.clearTimeout(diagnosticsTimerRef.current);
        diagnosticsTimerRef.current = null;
      }
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, transcript, diagnostics, micLevel, error, start, stop };
}

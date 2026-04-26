"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  RefreshCw,
  WifiOff,
  X,
} from "lucide-react";
import { Persona, type PersonaState } from "@/components/ai-elements/persona";
import { Button } from "@/components/ui/button";
import { useRealtimeVoice } from "@/hooks/useRealtimeVoice";
import { cn } from "@/lib/utils";
import { REALTIME_INTERVIEW_IDLE_COPY } from "./realtime-interview-copy";

const DEFAULT_SYSTEM_ROLE =
  "你是一位资深中文技术面试官，正在对候选人进行模拟面试。语气自然、像真人一样对话，不要念稿；每次只问一个问题，回答后根据候选人的表述自然追问或切换话题。";

export type RealtimeInterviewStatus = {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
};

type RealtimeInterviewPanelProps = {
  interviewId?: string;
  title?: string;
  systemRole?: string;
  speakingStyle?: string;
  botName?: string;
  className?: string;
  onStatusChange?: (status: RealtimeInterviewStatus) => void;
};

type TranscriptRole = "assistant" | "user";

const BAR_HEIGHTS = [35, 70, 50, 85, 45, 65, 40];

function UserVoiceBars({ active }: { active: boolean }) {
  return (
    <div className="flex h-5 items-end gap-[3px]">
      {BAR_HEIGHTS.map((height, index) => (
        <div
          key={index}
          className={cn(
            "w-[3px] rounded-full transition-colors duration-300",
            active ? "bg-[#34D399]" : "bg-[#2A3830]",
          )}
          style={{
            height: active ? `${height}%` : "20%",
            animationName: active ? "voiceBar" : "none",
            animationDuration: active ? "0.6s" : "0s",
            animationTimingFunction: "ease-in-out",
            animationIterationCount: active ? "infinite" : "1",
            animationDirection: "alternate",
            animationDelay: active ? `${index * 0.08}s` : "0s",
          }}
        />
      ))}
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#3A1A1A] bg-[#1F0E0E]">
        <WifiOff className="h-8 w-8 text-[#F87171]" />
      </div>
      <div className="text-center">
        <p className="text-base font-medium text-[#F87171]">连接失败</p>
        <p className="mt-1.5 max-w-[320px] text-sm leading-relaxed text-[#7A6060]">
          {error}
        </p>
      </div>
      <Button
        onClick={onRetry}
        className="gap-2 rounded-full bg-[#1E3028] px-5 text-sm text-[#34D399] hover:bg-[#253D30]"
        variant="ghost"
      >
        <RefreshCw className="h-4 w-4" />
        重新连接
      </Button>
    </div>
  );
}

function TranscriptDrawer({
  open,
  transcript,
  onClose,
}: {
  open: boolean;
  transcript: Array<{
    id: string;
    role: TranscriptRole;
    text: string;
    final: boolean;
  }>;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="flex w-[360px] flex-col border-l border-[#1A2820] bg-[#0A0F0D]">
        <div className="flex items-center justify-between border-b border-[#1A2820] px-4 py-3">
          <span className="text-sm font-medium text-[#6A8A74]">对话记录</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0 text-[#3A5045] hover:text-[#6A8A74]"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {transcript.length === 0 ? (
            <div className="rounded-2xl border border-[#1A2820] bg-[#0E1511] p-6 text-center text-sm text-[#53675C]">
              面试开始后，这里会显示完整对话记录。
            </div>
          ) : (
            <div className="space-y-4">
              {transcript.map((item, index) => (
                <div key={`${item.id}-${index}`} className="flex gap-3">
                  <div
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-full",
                      item.role === "assistant"
                        ? "bg-[#34D399]"
                        : "bg-[#60A5FA]",
                    )}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="text-xs font-medium text-[#7FA08A]">
                      {item.role === "assistant" ? "面试官" : "你"}
                      {!item.final ? (
                        <span className="ml-2 text-[#34D399]">输入中</span>
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        "rounded-xl border p-3 text-sm leading-relaxed",
                        item.role === "assistant"
                          ? "border-[#1B2C23] bg-[#101814] text-[#D6E7DE]"
                          : "border-[#173248] bg-[#0E1B25] text-[#C8DFF7]",
                      )}
                    >
                      {item.text || "…"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function resolvePersonaState(input: {
  isConnecting: boolean;
  isConnected: boolean;
  isAssistantSpeaking: boolean;
}): PersonaState {
  if (input.isConnecting) return "thinking";
  if (!input.isConnected) return "idle";
  if (input.isAssistantSpeaking) return "speaking";
  return "listening";
}

export function RealtimeInterviewPanel({
  interviewId,
  title = "综合面试",
  systemRole = DEFAULT_SYSTEM_ROLE,
  speakingStyle,
  botName = "面试官",
  className,
  onStatusChange,
}: RealtimeInterviewPanelProps) {
  const { state, transcript, diagnostics, micLevel, error, start, stop } =
    useRealtimeVoice({
      interviewId,
      systemRole,
      speakingStyle,
      botName,
    });
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

  const isConnected = state === "ready";
  const isConnecting = state === "connecting" || state === "session-starting";
  const isActive = isConnected || state === "session-starting";
  const lastAssistant = [...transcript]
    .reverse()
    .find((item) => item.role === "assistant");
  const lastUser = [...transcript]
    .reverse()
    .find((item) => item.role === "user");
  const isAssistantSpeaking = Boolean(lastAssistant && !lastAssistant.final);
  const isUserSpeaking = Boolean(lastUser && !lastUser.final);

  const personaState = resolvePersonaState({
    isConnecting,
    isConnected,
    isAssistantSpeaking,
  });

  const subtitle = useMemo(() => {
    if (isAssistantSpeaking) return lastAssistant?.text ?? null;
    if (isUserSpeaking) return lastUser?.text ?? null;
    const lastFinalAssistant = [...transcript]
      .reverse()
      .find((item) => item.role === "assistant" && item.final);
    return lastFinalAssistant?.text ?? null;
  }, [
    isAssistantSpeaking,
    isUserSpeaking,
    lastAssistant,
    lastUser,
    transcript,
  ]);

  useEffect(() => {
    onStatusChange?.({
      isConnected,
      isConnecting,
      error,
    });
  }, [error, isConnected, isConnecting, onStatusChange]);

  const finalCount = transcript.filter((item) => item.final).length;
  const hasError = Boolean(error) && !isConnected && !isConnecting;
  const isUserTurn = isConnected && !isAssistantSpeaking && !isConnecting;
  const levelActive = isUserSpeaking || micLevel > 0.08;
  const levelPercent = Math.min(100, Math.round(micLevel * 200));
  const transcriptCount = transcript.filter((item) => item.final).length;

  const statusLabel = hasError
    ? "连接失败"
    : isConnecting
      ? "连接中…"
      : !isConnected
        ? "未连接"
        : isAssistantSpeaking
          ? "面试官正在回答"
          : isUserSpeaking
            ? "正在聆听您的回答"
            : "请开始回答";

  const statusDot = hasError
    ? "bg-[#F87171]"
    : isConnecting
      ? "bg-[#94A3B8] animate-pulse"
      : !isConnected
        ? "bg-[#475569]"
        : isAssistantSpeaking
          ? "bg-[#34D399] animate-pulse"
          : isUserSpeaking
            ? "bg-[#60A5FA] animate-pulse"
            : "bg-[#34D399]";

  const statusPill = hasError
    ? "bg-[#1F0E0E] text-[#F87171]"
    : isConnecting
      ? "bg-[#1A2228] text-[#94A3B8]"
      : !isConnected
        ? "bg-[#151E1A] text-[#64748B]"
        : isAssistantSpeaking
          ? "bg-[#0D2E20] text-[#34D399]"
          : isUserSpeaking
            ? "bg-[#0A1E2E] text-[#60A5FA]"
            : "bg-[#122318] text-[#4ADE80]";

  return (
    <>
      <style>{`
        @keyframes voiceBar {
          from { height: 20%; }
          to { height: 100%; }
        }
      `}</style>

      <div
        className={cn(
          "relative flex h-full min-h-[calc(100vh-56px)] w-full flex-col overflow-hidden bg-[#0C1410]",
          className,
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 transition-all duration-1000",
            isAssistantSpeaking
              ? "bg-[radial-gradient(ellipse_70%_45%_at_50%_25%,_#0A2E1E_0%,_transparent_70%)]"
              : isUserSpeaking
                ? "bg-[radial-gradient(ellipse_70%_45%_at_50%_78%,_#091828_0%,_transparent_70%)]"
                : "bg-transparent",
          )}
        />

        <div className="relative z-10 flex w-full shrink-0 items-center justify-between px-5 pt-5">
          <div
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300",
              statusPill,
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                statusDot,
              )}
            />
            {statusLabel}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsTranscriptOpen(true)}
            className="h-8 gap-1.5 rounded-full bg-[#16201C] px-3 text-xs text-[#5A7060] hover:bg-[#1E2E28] hover:text-[#A0C0A8]"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            对话记录
            {transcriptCount > 0 ? (
              <span className="rounded-full bg-[#1A3A28] px-1.5 py-0.5 text-[10px] text-[#34D399]">
                {transcriptCount}
              </span>
            ) : null}
          </Button>
        </div>

        {hasError ? (
          <ErrorState error={error!} onRetry={() => void start()} />
        ) : (
          <>
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-6">
              <p className="text-[10px] tracking-[0.35em] uppercase text-[#3A5045]">
                {title}
              </p>

              <div className="relative flex h-48 w-48 items-center justify-center">
                {isAssistantSpeaking ? (
                  <>
                    <div
                      className="absolute h-52 w-52 animate-ping rounded-full bg-[#10B981]/8"
                      style={{ animationDuration: "1.8s" }}
                    />
                    <div
                      className="absolute h-48 w-48 animate-ping rounded-full bg-[#10B981]/12"
                      style={{
                        animationDuration: "1.4s",
                        animationDelay: "0.4s",
                      }}
                    />
                  </>
                ) : null}
                {isConnecting ? (
                  <div className="absolute h-44 w-44 animate-pulse rounded-full bg-[#10B981]/10" />
                ) : null}

                <Persona
                  variant="halo"
                  state={personaState}
                  className="relative z-10 h-44 w-44"
                />
              </div>

              <div className="flex min-h-[80px] w-full max-w-[580px] items-center justify-center px-2">
                {subtitle ? (
                  <p
                    className={cn(
                      "text-center text-[15px] leading-relaxed transition-colors duration-300",
                      isAssistantSpeaking
                        ? "font-medium text-[#C8E8D8]"
                        : isUserSpeaking
                          ? "italic text-[#93C5FD]"
                          : "text-[#506860]",
                    )}
                  >
                    {isUserSpeaking ? (
                      <span className="mr-1.5 not-italic text-[#60A5FA]">
                        你：
                      </span>
                    ) : null}
                    {subtitle}
                    {isAssistantSpeaking || isUserSpeaking ? (
                      <span className="ml-1 inline-block h-[1em] w-[2px] animate-pulse bg-current align-middle opacity-80" />
                    ) : null}
                  </p>
                ) : (
                  <p className="text-sm text-[#2A3E34]">
                    {isConnecting
                      ? "正在连接面试官，请稍候…"
                      : !isConnected
                        ? REALTIME_INTERVIEW_IDLE_COPY.hero
                        : ""}
                  </p>
                )}
              </div>
            </div>

            <div className="relative z-10 w-full px-8">
              <div className="h-px bg-gradient-to-r from-transparent via-[#1E3028] to-transparent" />
            </div>

            <div className="relative z-10 flex w-full shrink-0 flex-col items-center gap-4 px-6 pb-8 pt-6">
              <p className="text-[10px] tracking-[0.35em] uppercase text-[#3A5045]">
                你
              </p>

              <div className="relative flex h-24 w-24 items-center justify-center">
                {levelActive ? (
                  <>
                    <div className="absolute h-24 w-24 animate-ping rounded-full bg-[#38BDF8]/12" />
                    <div
                      className="absolute h-20 w-20 animate-ping rounded-full bg-[#38BDF8]/18"
                      style={{ animationDelay: "0.25s" }}
                    />
                  </>
                ) : null}
                {isUserTurn && isActive ? (
                  <div className="absolute h-20 w-20 animate-pulse rounded-full bg-[#34D399]/12" />
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      void stop();
                      return;
                    }
                    void start();
                  }}
                  disabled={isConnecting}
                  className={cn(
                    "relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300",
                    isActive
                      ? levelActive
                        ? "bg-[#38BDF8] shadow-[0_0_28px_rgba(56,189,248,0.4)] hover:brightness-110"
                        : "bg-[#10B981] shadow-[0_0_22px_rgba(16,185,129,0.35)] hover:shadow-[0_0_32px_rgba(16,185,129,0.5)]"
                      : "bg-[#161F1A] hover:bg-[#1C2A22]",
                    isConnecting && "cursor-not-allowed opacity-50",
                  )}
                >
                  {isConnecting ? (
                    <Loader2 className="h-6 w-6 animate-spin text-[#94A3B8]" />
                  ) : isActive ? (
                    <Mic className="h-6 w-6 text-[#050A07]" />
                  ) : (
                    <MicOff className="h-6 w-6 text-[#3A5045]" />
                  )}
                </button>
              </div>

              <UserVoiceBars active={levelActive} />

              <p
                className={cn(
                  "text-xs transition-colors duration-300",
                  levelActive
                    ? "text-[#60A5FA]"
                    : isUserTurn && isActive
                      ? "text-[#34D399]"
                      : "text-[#2E4238]",
                )}
              >
                {!isConnected
                  ? isConnecting
                    ? "正在初始化语音会话…"
                    : REALTIME_INTERVIEW_IDLE_COPY.footer
                  : isAssistantSpeaking
                    ? "面试官正在回答，请稍候"
                    : isUserSpeaking
                      ? `正在识别您的语音… ${levelPercent}%`
                      : "请直接开始回答，系统会实时追问"}
              </p>

              <div className="flex items-center gap-2 text-xs text-[#52665B]">
                <Activity className="h-3.5 w-3.5" />
                <span>
                  {isConnected
                    ? "实时语音已就绪"
                    : isConnecting
                      ? "正在建立语音连接"
                      : "等待开始面试"}
                </span>
              </div>
            </div>
          </>
        )}

        <TranscriptDrawer
          open={isTranscriptOpen}
          transcript={transcript}
          onClose={() => setIsTranscriptOpen(false)}
        />
      </div>
    </>
  );
}

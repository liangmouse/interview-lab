"use client";

import { useState, useMemo } from "react";
import {
  Mic,
  MicOff,
  MessageSquare,
  X,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Persona, type PersonaState } from "@/components/ai-elements/persona";
import { TranscriptStream, type TranscriptItemData } from "./transcript-stream";

interface VoiceFirstPanelProps {
  isConnected: boolean;
  isConnecting: boolean;
  isMicEnabled: boolean;
  isAgentSpeaking: boolean;
  isUserSpeaking: boolean;
  isAudioPlaybackBlocked: boolean;
  transcript: TranscriptItemData[];
  onMicToggle: () => void;
  manualDraftText: string;
  isPushToTalkPressed?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function resolvePersonaState({
  isConnecting,
  isConnected,
  isAgentSpeaking,
}: Pick<
  VoiceFirstPanelProps,
  "isConnecting" | "isConnected" | "isAgentSpeaking"
>): PersonaState {
  if (isConnecting) return "thinking";
  if (!isConnected) return "idle";
  if (isAgentSpeaking) return "speaking";
  return "listening";
}

const BAR_HEIGHTS = [35, 70, 50, 85, 45, 65, 40];

function UserVoiceBars({ active }: { active: boolean }) {
  return (
    <div className="flex h-5 items-end gap-[3px]">
      {BAR_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className={cn(
            "w-[3px] rounded-full transition-colors duration-300",
            active ? "bg-[#34D399]" : "bg-[#2A3830]",
          )}
          style={{
            height: active ? `${h}%` : "20%",
            animationName: active ? "voiceBar" : "none",
            animationDuration: active ? "0.6s" : "0s",
            animationTimingFunction: "ease-in-out",
            animationIterationCount: active ? "infinite" : "1",
            animationDirection: "alternate",
            animationDelay: active ? `${i * 0.08}s` : "0s",
          }}
        />
      ))}
    </div>
  );
}

/** 连接失败时的错误状态 */
function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
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
      {onRetry && (
        <Button
          onClick={onRetry}
          className="gap-2 rounded-full bg-[#1E3028] px-5 text-sm text-[#34D399] hover:bg-[#253D30]"
          variant="ghost"
        >
          <RefreshCw className="h-4 w-4" />
          重新连接
        </Button>
      )}
    </div>
  );
}

export function VoiceFirstPanel({
  isConnected,
  isConnecting,
  isMicEnabled,
  isAgentSpeaking,
  isUserSpeaking,
  isAudioPlaybackBlocked,
  transcript,
  onMicToggle,
  manualDraftText,
  isPushToTalkPressed = false,
  error,
  onRetry,
}: VoiceFirstPanelProps) {
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

  const personaState = resolvePersonaState({
    isConnecting,
    isConnected,
    isAgentSpeaking,
  });

  const subtitle = useMemo(() => {
    if (isAgentSpeaking) {
      const last = [...transcript].reverse().find((t) => t.role === "agent");
      return last?.text ?? null;
    }
    if (isUserSpeaking && manualDraftText) return manualDraftText;
    const lastFinal = [...transcript]
      .reverse()
      .find((t) => t.role === "agent" && t.isFinal);
    return lastFinal?.text ?? null;
  }, [isAgentSpeaking, isUserSpeaking, manualDraftText, transcript]);

  const isUserTurn = isConnected && !isAgentSpeaking && !isConnecting;
  const hasError = Boolean(error) && !isConnected && !isConnecting;

  // ── 状态标签 ──
  const statusLabel = hasError
    ? "连接失败"
    : isConnecting
      ? "连接中…"
      : !isConnected
        ? "未连接"
        : isAgentSpeaking
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
        : isAgentSpeaking
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
        : isAgentSpeaking
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

      <div className="relative flex h-full w-full flex-col items-center overflow-hidden bg-[#0C1410]">
        {/* 背景光晕 */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 transition-all duration-1000",
            isAgentSpeaking
              ? "bg-[radial-gradient(ellipse_70%_45%_at_50%_25%,_#0A2E1E_0%,_transparent_70%)]"
              : isUserSpeaking
                ? "bg-[radial-gradient(ellipse_70%_45%_at_50%_78%,_#091828_0%,_transparent_70%)]"
                : "bg-transparent",
          )}
        />

        {/* ── 顶部状态栏 ── */}
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
            {transcript.filter((t) => t.isFinal).length > 0 && (
              <span className="rounded-full bg-[#1A3A28] px-1.5 py-0.5 text-[10px] text-[#34D399]">
                {transcript.filter((t) => t.isFinal).length}
              </span>
            )}
          </Button>
        </div>

        {/* ── 主体：Error / 正常流 ── */}
        {hasError ? (
          <ErrorState error={error!} onRetry={onRetry} />
        ) : (
          <>
            {/* AI 区域 */}
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-6">
              <p className="text-[10px] tracking-[0.35em] uppercase text-[#3A5045]">
                面试官
              </p>

              {/* Persona 动画 + fallback 轮廓 */}
              <div className="relative flex h-48 w-48 items-center justify-center">
                {/* 说话时的外圈脉冲 */}
                {isAgentSpeaking && (
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
                )}
                {/* 连接中的慢脉冲 */}
                {isConnecting && (
                  <div className="absolute h-44 w-44 animate-pulse rounded-full bg-[#10B981]/10" />
                )}

                {/* Rive Persona */}
                <Persona
                  variant="halo"
                  state={personaState}
                  className="relative z-10 h-44 w-44"
                />
              </div>

              {/* 字幕区域 */}
              <div className="flex min-h-[80px] w-full max-w-[580px] items-center justify-center px-2">
                {subtitle ? (
                  <p
                    className={cn(
                      "text-center text-[15px] leading-relaxed transition-colors duration-300",
                      isAgentSpeaking
                        ? "font-medium text-[#C8E8D8]"
                        : isUserSpeaking
                          ? "italic text-[#93C5FD]"
                          : "text-[#506860]",
                    )}
                  >
                    {isUserSpeaking && (
                      <span className="mr-1.5 not-italic text-[#60A5FA]">
                        你：
                      </span>
                    )}
                    {subtitle}
                    {(isAgentSpeaking || isUserSpeaking) && (
                      <span className="ml-1 inline-block h-[1em] w-[2px] animate-pulse bg-current align-middle opacity-80" />
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-[#2A3E34]">
                    {isConnecting
                      ? "正在连接面试官，请稍候…"
                      : isConnected
                        ? "面试即将开始"
                        : ""}
                  </p>
                )}
              </div>
            </div>

            {/* 分隔线 */}
            <div className="relative z-10 w-full px-8">
              <div className="h-px bg-gradient-to-r from-transparent via-[#1E3028] to-transparent" />
            </div>

            {/* 用户区域 */}
            <div className="relative z-10 flex w-full shrink-0 flex-col items-center gap-4 px-6 pb-8 pt-6">
              <p className="text-[10px] tracking-[0.35em] uppercase text-[#3A5045]">
                你
              </p>

              {/* 麦克风按钮 */}
              <div className="relative flex h-24 w-24 items-center justify-center">
                {isUserSpeaking && (
                  <>
                    <div className="absolute h-24 w-24 animate-ping rounded-full bg-[#38BDF8]/12" />
                    <div
                      className="absolute h-20 w-20 animate-ping rounded-full bg-[#38BDF8]/18"
                      style={{ animationDelay: "0.25s" }}
                    />
                  </>
                )}
                {isUserTurn && !isUserSpeaking && isMicEnabled && (
                  <div className="absolute h-20 w-20 animate-pulse rounded-full bg-[#34D399]/12" />
                )}

                <button
                  onClick={onMicToggle}
                  disabled={!isConnected}
                  className={cn(
                    "relative flex h-16 w-16 items-center justify-center rounded-full transition-all duration-300",
                    isMicEnabled && isConnected
                      ? isUserSpeaking
                        ? "bg-[#38BDF8] shadow-[0_0_28px_rgba(56,189,248,0.4)] hover:brightness-110"
                        : "bg-[#10B981] shadow-[0_0_22px_rgba(16,185,129,0.35)] hover:shadow-[0_0_32px_rgba(16,185,129,0.5)]"
                      : "bg-[#161F1A] hover:bg-[#1C2A22]",
                    !isConnected && "cursor-not-allowed opacity-40",
                  )}
                >
                  {isMicEnabled && isConnected ? (
                    <Mic className="h-6 w-6 text-[#050A07]" />
                  ) : (
                    <MicOff className="h-6 w-6 text-[#3A5045]" />
                  )}
                </button>
              </div>

              {/* 声音条 */}
              <UserVoiceBars active={isUserSpeaking} />

              {/* 状态文字 */}
              <p
                className={cn(
                  "text-xs transition-colors duration-300",
                  isUserSpeaking
                    ? "text-[#60A5FA]"
                    : isUserTurn && isMicEnabled
                      ? "text-[#34D399]"
                      : "text-[#2E4238]",
                )}
              >
                {!isConnected
                  ? ""
                  : isAgentSpeaking
                    ? "面试官正在回答，请稍候"
                    : isUserSpeaking
                      ? "正在识别您的语音…"
                      : isMicEnabled
                        ? isPushToTalkPressed
                          ? "松开空格后立即发送"
                          : "按住空格开始回答，松开发送"
                        : "麦克风已静音，点击按钮开启"}
              </p>

              {isAudioPlaybackBlocked && (
                <p className="rounded-lg bg-[#2A1A08] px-3 py-1.5 text-xs text-[#F59E0B]">
                  浏览器拦截了音频播放，请点击页面任意位置开启
                </p>
              )}
            </div>
          </>
        )}

        {/* 对话记录抽屉 */}
        {isTranscriptOpen && (
          <div className="absolute inset-0 z-50 flex">
            <div
              className="flex-1 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsTranscriptOpen(false)}
            />
            <div className="flex w-[360px] flex-col border-l border-[#1A2820] bg-[#0A0F0D]">
              <div className="flex items-center justify-between border-b border-[#1A2820] px-4 py-3">
                <span className="text-sm font-medium text-[#6A8A74]">
                  对话记录
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTranscriptOpen(false)}
                  className="h-7 w-7 p-0 text-[#3A5045] hover:text-[#6A8A74]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <TranscriptStream
                  transcript={transcript}
                  isConnected={isConnected}
                  isConnecting={isConnecting}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

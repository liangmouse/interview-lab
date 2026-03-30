"use client";

import { TranscriptStream, type TranscriptItemData } from "./transcript-stream";
import { ControlDock } from "./control-dock";
import { resolveInputTextFromTranscription } from "./transcription-input-sync";
import { useTranslations } from "next-intl";
import { Loader2, Mic, MicOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { type AgentState } from "@livekit/components-react";
import { AgentAudioVisualizerAura } from "@/components/agents-ui/agent-audio-visualizer-aura";
import { Button } from "@/components/ui/button";

interface AIInterviewerPanelProps {
  /** 回合模式 */
  turnMode: "manual" | "vad";
  /** 是否已连接到 LiveKit 房间 */
  isConnected: boolean;
  /** 是否正在连接 */
  isConnecting: boolean;
  /** 麦克风是否启用 */
  isMicEnabled: boolean;
  /** Agent 是否正在说话 */
  isAgentSpeaking: boolean;
  /** Agent 当前可视化状态 */
  agentState: AgentState;
  /** 用户是否正在说话 */
  isUserSpeaking: boolean;
  /** 浏览器是否拦截了 Agent 语音播放 */
  isAudioPlaybackBlocked: boolean;
  /** 转写内容 */
  transcript: TranscriptItemData[];
  /** 切换麦克风回调 */
  onMicToggle: () => void;
  /** 最新用户实时转写 */
  manualDraftText: string;
  /** 发送文本消息回调 */
  onSendMessage?: (text: string) => void;
}

export function AIInterviewerPanel({
  turnMode,
  isConnected,
  isConnecting,
  isMicEnabled,
  isAgentSpeaking,
  agentState,
  isUserSpeaking,
  isAudioPlaybackBlocked,
  transcript,
  onMicToggle,
  manualDraftText,
  onSendMessage,
}: AIInterviewerPanelProps) {
  const t = useTranslations("interview");
  const { resolvedTheme } = useTheme();
  const [inputText, setInputText] = useState("");
  const [hasEditedCurrentTurn, setHasEditedCurrentTurn] = useState(false);

  useEffect(() => {
    setInputText((prev) =>
      resolveInputTextFromTranscription({
        currentInputText: prev,
        transcriptionText: manualDraftText,
        hasEditedCurrentTurn,
      }),
    );
  }, [manualDraftText, hasEditedCurrentTurn]);

  const handleInputTextChange = useCallback((nextText: string) => {
    setInputText(nextText);
    setHasEditedCurrentTurn(true);
  }, []);

  const handleSendMessage = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage?.(trimmed);
    setInputText("");
    setHasEditedCurrentTurn(false);
  }, [inputText, onSendMessage]);

  // 获取当前状态文本
  const getStatusText = () => {
    if (isConnecting) {
      return t("connecting");
    }
    if (!isConnected) {
      return t("disconnected");
    }
    if (isAgentSpeaking) {
      return t("speaking");
    }
    if (isUserSpeaking) {
      return t("userSpeaking");
    }
    return t("listening");
  };

  return (
    <div className="flex h-full w-full flex-col bg-[radial-gradient(circle_at_top,_#EFFAF5,_#FDFCF8_58%)]">
      <div className="mx-auto flex min-h-0 w-full max-w-[1180px] flex-1 flex-col gap-4 px-4 py-4 md:px-6">
        <section className="grid gap-4 rounded-2xl border border-[#DCE5E0] bg-white/85 p-4 shadow-[0_10px_30px_rgba(15,62,46,0.06)] md:grid-cols-[1fr_auto] md:items-center">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-[#7A8A83]">
              {t("interviewPulse")}
            </p>
            <p className="text-lg font-semibold text-[#163B2E]">
              {isConnecting ? t("connectingInterviewer") : t("liveInterview")}
            </p>
            <span
              className={cn(
                "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                isConnected
                  ? "border-[#A7E5CA] bg-[#E8FAF1] text-[#0D8B58]"
                  : "border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]",
              )}
            >
              {getStatusText()}
            </span>
            {isAudioPlaybackBlocked ? (
              <p className="text-sm text-[#B45309]">
                浏览器拦截了语音播放，请点击页面任意位置开启音频。
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-4 justify-center md:justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMicToggle}
              disabled={!isConnected}
              title={isMicEnabled ? "关闭麦克风" : "开启麦克风"}
              className={cn(
                "h-12 w-12 rounded-full p-0 transition-all",
                isMicEnabled && isConnected
                  ? "bg-[#10B981] text-white shadow-md hover:bg-[#10B981]/90"
                  : "bg-[#F3F4F6] text-[#9CA3AF] hover:bg-[#ECF3EF] hover:text-[#6B7280]",
                !isConnected && "cursor-not-allowed opacity-40",
              )}
            >
              {isMicEnabled && isConnected ? (
                <Mic className="h-5 w-5" />
              ) : (
                <MicOff className="h-5 w-5" />
              )}
            </Button>
            {isConnecting ? (
              <div className="flex h-[140px] w-[180px] flex-col items-center justify-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-[#10B981]" />
              </div>
            ) : (
              <AgentAudioVisualizerAura
                size="xl"
                color="#c8ff00"
                colorShift={0.3}
                state={agentState}
                themeMode={resolvedTheme as "dark" | "light" | undefined}
                className="aspect-square size-auto w-[140px]"
              />
            )}
          </div>
        </section>

        <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-[#DCE5E0] bg-white/90 shadow-[0_10px_30px_rgba(15,62,46,0.06)]">
          <TranscriptStream
            transcript={transcript}
            isConnected={isConnected}
            isConnecting={isConnecting}
          />
        </section>
      </div>

      <div className="px-4 pb-4 md:px-6">
        <div className="mx-auto w-full max-w-[1180px]">
          <ControlDock
            turnMode={turnMode}
            isMicActive={isMicEnabled && isConnected}
            inputText={inputText}
            onInputTextChange={handleInputTextChange}
            onSendMessage={handleSendMessage}
            disabled={!isConnected}
          />
        </div>
      </div>
    </div>
  );
}

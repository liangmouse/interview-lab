"use client";

import { useRef, useEffect, useCallback } from "react";
import { Bot, User, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { type TranscriptItem } from "@/hooks/interview-voice-runtime-types";
import { cn } from "@/lib/utils";

// 为了向后兼容，导出别名
export type { TranscriptItem as TranscriptItemData };

/** 打字机光标组件 - 闪烁效果 */
function TypingCursor() {
  return (
    <span className="inline-block w-[2px] h-[1em] bg-current ml-[2px] animate-pulse" />
  );
}

interface TranscriptStreamProps {
  /** 转写内容列表 */
  transcript: TranscriptItem[];
  /** 是否已连接 */
  isConnected: boolean;
  /** 是否正在连接 */
  isConnecting: boolean;
}

/** 格式化时间戳为 mm:ss */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function TranscriptStream({
  transcript,
  isConnected,
  isConnecting,
}: TranscriptStreamProps) {
  const t = useTranslations("interview");

  // Refs for auto-scroll functionality
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Check if user is near the bottom of the scroll container
  const isNearBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    const threshold = 100; // Consider "at bottom" if within 100px
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    );
  }, []);

  // Auto-scroll to bottom when new messages arrive (only if user is already near bottom)
  useEffect(() => {
    if (transcript.length > 0 && isNearBottom()) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcript, isNearBottom]);

  // 空状态：未连接或无转写内容
  if (!isConnected && !isConnecting) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-2xl border border-[#DCE5E0] bg-[#F7FBF9] p-8 text-center">
          <MessageSquare className="mx-auto mb-4 h-12 w-12 text-[#B8C3BE]" />
          <p className="text-base font-medium text-[#3C5148]">
            {t("waitingToConnect")}
          </p>
          <p className="mt-2 text-sm text-[#7A8A83]">
            {t("waitingToConnectHint")}
          </p>
        </div>
      </div>
    );
  }

  if (transcript.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-2xl border border-[#DCE5E0] bg-[#F7FBF9] p-8 text-center">
          <MessageSquare className="mx-auto mb-4 h-12 w-12 text-[#B8C3BE]" />
          <p className="text-base font-medium text-[#3C5148]">
            {isConnecting
              ? t("connectingInterviewer")
              : t("interviewStartsSoon")}
          </p>
          <p className="mt-2 text-sm text-[#7A8A83]">
            {t("interviewStartsSoonHint")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="h-full overflow-y-auto px-4 py-5 md:px-6"
    >
      <div className="mx-auto w-full max-w-4xl space-y-4">
        {transcript.map((message, index) => (
          <div
            key={`${message.id}-${index}`}
            className={cn(
              "flex gap-3",
              message.role === "user" && "opacity-90",
            )}
          >
            <div className="flex-shrink-0">
              {message.role === "agent" ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#DCE5E0] bg-white shadow-sm">
                  <Bot className="h-4 w-4 text-[#163B2E]" />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#DCE5E0] bg-[#EFFAF5]">
                  <User className="h-4 w-4 text-[#0D8B58]" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#141414]">
                  {message.role === "agent" ? t("aiInterviewer") : t("you")}
                </span>
                <span className="text-xs text-[#999999]">
                  {formatTimestamp(message.timestamp)}
                </span>
                {!message.isFinal && (
                  <span className="text-xs text-[#10B981]">•</span>
                )}
              </div>
              <div
                className={cn(
                  "rounded-xl border p-3 text-sm leading-relaxed",
                  message.role === "agent"
                    ? "border-[#DCE5E0] bg-white text-[#1F2937]"
                    : "border-[#BDEFD7] bg-[#F3FCF8] text-[#3C5148]",
                  !message.isFinal && "border-l-2 border-l-[#10B981]",
                )}
              >
                {message.text.includes("```") ? (
                  <div>
                    {message.text
                      .split("```")
                      .map((part: string, i: number) => {
                        if (i % 2 === 1) {
                          const [, ...code] = part.split("\n");
                          return (
                            <pre
                              key={i}
                              className="my-2 overflow-x-auto rounded bg-[#1E1E20] p-3 text-xs"
                            >
                              <code className="text-[#E5E5E5]">
                                {code.join("\n")}
                              </code>
                            </pre>
                          );
                        }
                        return <span key={i}>{part}</span>;
                      })}
                    {/* 非 final 消息显示闪烁光标 */}
                    {!message.isFinal && <TypingCursor />}
                  </div>
                ) : (
                  <>
                    {message.text}
                    {/* 非 final 消息显示闪烁光标 */}
                    {!message.isFinal && <TypingCursor />}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {/* Bottom anchor for auto-scroll */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

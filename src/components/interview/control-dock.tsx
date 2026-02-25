"use client";

import { useRef, useCallback, KeyboardEvent } from "react";
import { Mic, MicOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ControlDockProps {
  /** 回合模式 */
  turnMode: "manual" | "vad";
  /** 麦克风是否激活 */
  isMicActive: boolean;
  /** 切换麦克风 */
  onMicToggle: () => void;
  /** 输入框文本 */
  inputText: string;
  /** 输入框变更 */
  onInputTextChange: (text: string) => void;
  /** 发送文本消息 */
  onSendMessage: () => void;
  /** 是否禁用 */
  disabled?: boolean;
}

export function ControlDock({
  turnMode,
  isMicActive,
  onMicToggle,
  inputText,
  onInputTextChange,
  onSendMessage,
  disabled = false,
}: ControlDockProps) {
  const t = useTranslations("interview");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isVadMode = turnMode === "vad";

  // 发送消息
  const handleSendMessage = useCallback(() => {
    if (!inputText.trim() || disabled) return;
    onSendMessage();
    inputRef.current?.focus();
  }, [inputText, disabled, onSendMessage]);

  // 键盘事件：回车发送
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  return (
    <div className="rounded-2xl border border-[#DCE5E0] bg-white/90 px-3 py-3 shadow-[0_10px_30px_rgba(15,62,46,0.08)] backdrop-blur-sm md:px-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
              isMicActive && !disabled
                ? "bg-[#10B981] animate-pulse"
                : "bg-[#CBD5D1]",
            )}
          />
          <Textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => onInputTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isVadMode ? t("speechTranscribingHint") : t("typeResponse")
            }
            disabled={disabled}
            rows={1}
            className={cn(
              "min-h-[54px] max-h-36 flex-1 resize-none rounded-xl border border-[#DCE5E0] bg-white px-3 py-3 text-sm text-[#1F2937] transition-all duration-200 focus-visible:ring-[#10B981]/30",
              disabled && "cursor-not-allowed opacity-50",
            )}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMicToggle}
            disabled={disabled}
            className={cn(
              "h-11 w-11 rounded-full p-0 transition-all",
              isMicActive && !disabled
                ? "bg-[#10B981] text-white shadow-md hover:bg-[#10B981]/90"
                : "text-[#6B7280] hover:bg-[#ECF3EF] hover:text-[#1F2937]",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {isMicActive && !disabled ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSendMessage}
            disabled={disabled || !inputText.trim()}
            className={cn(
              "h-11 w-11 rounded-full p-0 text-[#10B981] hover:bg-[#10B981]/10",
              (disabled || !inputText.trim()) &&
                "cursor-not-allowed opacity-50",
            )}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

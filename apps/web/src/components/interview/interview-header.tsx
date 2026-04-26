"use client";

import { useState, useEffect } from "react";
import {
  X,
  Maximize2,
  Wifi,
  WifiOff,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface InterviewHeaderProps {
  isConnected?: boolean;
  isConnecting?: boolean;
  error?: string | null;
  isResumePanelOpen?: boolean;
  onToggleResumePanel?: () => void;
  isCodeWorkbenchOpen?: boolean;
  onToggleCodeWorkbench?: () => void;
}

export function InterviewHeader({
  isConnected = false,
  isConnecting = false,
  error = null,
  isResumePanelOpen = false,
  onToggleResumePanel,
  isCodeWorkbenchOpen = false,
  onToggleCodeWorkbench,
}: InterviewHeaderProps) {
  const t = useTranslations("interview");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // 只有连接成功后才开始计时
    if (!isConnected) return;

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // 连接状态指示器
  const renderConnectionStatus = () => {
    if (isConnecting) {
      return (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("connecting")}</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <WifiOff className="h-4 w-4" />
          <span>{t("connectionFailed")}</span>
        </div>
      );
    }

    if (isConnected) {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <Wifi className="h-4 w-4" />
          <span>{t("connected")}</span>
        </div>
      );
    }

    return null;
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-[#E5E5E5] bg-white px-4 md:px-6">
      <Link
        href="/dashboard"
        className="text-sm text-[#666666] hover:text-[#141414]"
      >
        <X className="h-5 w-5" />
      </Link>

      <div className="flex items-center gap-6">
        {/* 连接状态 */}
        {renderConnectionStatus()}

        {/* 计时器 */}
        <div className="text-sm text-[#666666]">
          {t("timeElapsed")}:{" "}
          <span className="font-medium text-[#141414]">
            {formatTime(elapsed)}
          </span>
        </div>

        {onToggleResumePanel ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleResumePanel}
            className={cn("hidden md:flex")}
            aria-label={
              isResumePanelOpen ? t("hideResumePanel") : t("showResumePanel")
            }
          >
            {isResumePanelOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
            <span className="text-xs">
              {isResumePanelOpen ? t("hideResumePanel") : t("showResumePanel")}
            </span>
          </Button>
        ) : null}

        {onToggleCodeWorkbench ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCodeWorkbench}
            className={cn(
              "hidden md:flex",
              isCodeWorkbenchOpen && "text-[#10B981]",
            )}
          >
            {isCodeWorkbenchOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        ) : null}

        <Button variant="ghost" size="sm" className="hidden md:flex">
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

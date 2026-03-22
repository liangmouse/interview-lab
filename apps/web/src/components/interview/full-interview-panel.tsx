"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Loader2,
  MonitorSmartphone,
  Server,
  Layers,
  Smartphone,
  Zap,
  BookOpen,
  Trophy,
  Flame,
  Clock,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createInterview,
  type InterviewTopic,
  type InterviewDifficulty,
} from "@/action/create-interview";
import { toast } from "sonner";

const TOPICS: {
  value: InterviewTopic;
  label: string;
  icon: React.ElementType;
  desc: string;
}[] = [
  {
    value: "frontend",
    label: "前端开发",
    icon: MonitorSmartphone,
    desc: "React / Vue / JS / CSS",
  },
  {
    value: "backend",
    label: "后端开发",
    icon: Server,
    desc: "Node / Go / Java / Python",
  },
  {
    value: "fullstack",
    label: "全栈开发",
    icon: Layers,
    desc: "端到端系统设计与实现",
  },
  {
    value: "mobile",
    label: "移动开发",
    icon: Smartphone,
    desc: "iOS / Android / RN / Flutter",
  },
];

const DIFFICULTIES: {
  value: InterviewDifficulty;
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { value: "beginner", label: "初级", icon: BookOpen, color: "text-sky-600" },
  {
    value: "intermediate",
    label: "中级",
    icon: Zap,
    color: "text-amber-600",
  },
  { value: "advanced", label: "高级", icon: Flame, color: "text-orange-600" },
  { value: "expert", label: "专家", icon: Trophy, color: "text-rose-600" },
];

const DURATIONS = [
  { value: 10, label: "10 min", desc: "快速热身" },
  { value: 25, label: "25 min", desc: "标准训练" },
  { value: 40, label: "40 min", desc: "深度模拟" },
  { value: 60, label: "60 min", desc: "完整面试" },
];

interface SelectPillProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

function SelectPill({
  selected,
  onClick,
  children,
  className,
}: SelectPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-150 select-none",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-secondary",
        className,
      )}
    >
      {children}
    </button>
  );
}

interface TopicCardProps {
  topic: (typeof TOPICS)[number];
  selected: boolean;
  onClick: () => void;
}

function TopicCard({ topic, selected, onClick }: TopicCardProps) {
  const Icon = topic.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex cursor-pointer flex-col items-start rounded-xl border p-4 text-left transition-all duration-150 select-none",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm"
          : "border-border bg-card hover:border-primary/30 hover:bg-secondary/60 hover:shadow-sm",
      )}
    >
      <div
        className={cn(
          "mb-3 flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
          selected
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p
        className={cn(
          "text-sm font-semibold",
          selected ? "text-primary" : "text-foreground",
        )}
      >
        {topic.label}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{topic.desc}</p>
    </button>
  );
}

export function FullInterviewPanel() {
  const t = useTranslations("dashboard.simulation");
  const router = useRouter();

  const [topic, setTopic] = useState<InterviewTopic | null>(null);
  const [difficulty, setDifficulty] = useState<InterviewDifficulty | null>(
    null,
  );
  const [duration, setDuration] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isLoading || isPending;

  const handleStart = useCallback(async () => {
    if (!topic) {
      toast.error("请选择岗位方向");
      return;
    }
    if (!difficulty) {
      toast.error("请选择面试难度");
      return;
    }
    if (!duration) {
      toast.error("请选择面试时长");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createInterview({ topic, difficulty, duration });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.interviewId) {
        startTransition(() => {
          router.push(`/interview/${result.interviewId}`);
        });
      }
    } catch {
      toast.error("启动面试失败，请重试");
    } finally {
      setIsLoading(false);
    }
  }, [topic, difficulty, duration, router]);

  const isReady = !!topic && !!difficulty && !!duration;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">综合面试</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("fullInterviewDesc" as Parameters<typeof t>[0])}
            </p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        {/* Topic */}
        <div className="p-6">
          <label className="mb-3 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            岗位方向
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TOPICS.map((t) => (
              <TopicCard
                key={t.value}
                topic={t}
                selected={topic === t.value}
                onClick={() => setTopic(t.value)}
              />
            ))}
          </div>
        </div>

        <div className="mx-6 border-t border-border/60" />

        {/* Difficulty */}
        <div className="p-6">
          <label className="mb-3 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            面试难度
          </label>
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => {
              const DiffIcon = d.icon;
              return (
                <SelectPill
                  key={d.value}
                  selected={difficulty === d.value}
                  onClick={() => setDifficulty(d.value)}
                >
                  <DiffIcon
                    className={cn(
                      "mr-1.5 h-3.5 w-3.5",
                      difficulty === d.value ? "text-primary-foreground" : d.color,
                    )}
                  />
                  {d.label}
                </SelectPill>
              );
            })}
          </div>
        </div>

        <div className="mx-6 border-t border-border/60" />

        {/* Duration */}
        <div className="p-6">
          <label className="mb-3 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            面试时长
          </label>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <SelectPill
                key={d.value}
                selected={duration === d.value}
                onClick={() => setDuration(d.value)}
                className="flex-col gap-0"
              >
                <span className="flex items-center gap-1">
                  <Clock
                    className={cn(
                      "h-3.5 w-3.5",
                      duration === d.value
                        ? "text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                  />
                  {d.label}
                </span>
                <span
                  className={cn(
                    "text-[10px]",
                    duration === d.value
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground/70",
                  )}
                >
                  {d.desc}
                </span>
              </SelectPill>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="border-t border-border/60 bg-secondary/30 px-6 py-4">
          <Button
            size="lg"
            onClick={handleStart}
            disabled={isBusy || !isReady}
            className={cn(
              "w-full h-12 text-base font-medium transition-all duration-200",
              isReady
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md"
                : "opacity-50",
            )}
          >
            {isBusy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isLoading ? "正在创建面试..." : "正在跳转..."}
              </>
            ) : (
              <>
                开始综合面试
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
          {!isReady && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              请完成上方所有配置后开始
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

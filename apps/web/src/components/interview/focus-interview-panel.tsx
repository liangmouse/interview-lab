"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Users,
  Code2,
  MessageSquare,
  Network,
  Zap,
  BookOpen,
  Trophy,
  Flame,
  Clock,
  ChevronRight,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createInterview,
  type InterviewTopic,
  type InterviewDifficulty,
} from "@/action/create-interview";
import {
  CODING_INTERVIEW_DEFAULT_DURATION_MINUTES,
  CODING_INTERVIEW_QUESTION_COUNT,
  FOCUS_CODING_TOPIC,
} from "@/lib/interview-session";
import { toast } from "sonner";

const FOCUS_AREAS: {
  value: InterviewTopic;
  label: string;
  icon: React.ElementType;
  desc: string;
  tag: string;
  tagColor: string;
}[] = [
  {
    value: "frontend",
    label: "HR 面试",
    icon: Users,
    desc: "职业规划、团队协作、软技能与行为面试问题训练",
    tag: "综合素质",
    tagColor: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  {
    value: "backend",
    label: "技术问答",
    icon: MessageSquare,
    desc: "数据结构、算法原理、系统知识与技术深度考察",
    tag: "技术知识",
    tagColor: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  {
    value: "fullstack",
    label: "代码编程",
    icon: Code2,
    desc: "LeetCode 风格算法题与实际工程代码实现训练",
    tag: "Coding",
    tagColor: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  {
    value: "mobile",
    label: "系统设计",
    icon: Network,
    desc: "大规模系统架构设计、可扩展性与工程决策训练",
    tag: "架构设计",
    tagColor: "bg-amber-50 text-amber-700 ring-amber-200",
  },
];

const DIFFICULTIES: {
  value: InterviewDifficulty;
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { value: "beginner", label: "初级", icon: BookOpen, color: "text-sky-600" },
  { value: "intermediate", label: "中级", icon: Zap, color: "text-amber-600" },
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

interface FocusAreaCardProps {
  area: (typeof FOCUS_AREAS)[number];
  selected: boolean;
  onClick: () => void;
}

function FocusAreaCard({ area, selected, onClick }: FocusAreaCardProps) {
  const Icon = area.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex cursor-pointer flex-col items-start rounded-xl border p-5 text-left transition-all duration-150 select-none",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm"
          : "border-border bg-card hover:border-primary/30 hover:bg-secondary/60 hover:shadow-sm",
      )}
    >
      <div className="mb-3 flex w-full items-start justify-between">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
            selected
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
            area.tagColor,
          )}
        >
          {area.tag}
        </span>
      </div>
      <p
        className={cn(
          "text-sm font-semibold",
          selected ? "text-primary" : "text-foreground",
        )}
      >
        {area.label}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {area.desc}
      </p>
      {selected && (
        <div className="absolute right-3 bottom-3">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
            <svg
              className="h-3 w-3 text-primary-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
      )}
    </button>
  );
}

export function FocusInterviewPanel() {
  const router = useRouter();

  const [focusArea, setFocusArea] = useState<InterviewTopic | null>(null);
  const [difficulty, setDifficulty] = useState<InterviewDifficulty | null>(
    null,
  );
  const [duration, setDuration] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isLoading || isPending;
  const isCodingFocus = focusArea === FOCUS_CODING_TOPIC;

  const handleStart = useCallback(async () => {
    if (!focusArea) {
      toast.error("请选择专项方向");
      return;
    }
    if (!difficulty) {
      toast.error("请选择面试难度");
      return;
    }
    if (!isCodingFocus && !duration) {
      toast.error("请选择面试时长");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createInterview({
        topic: focusArea,
        difficulty,
        duration: isCodingFocus
          ? CODING_INTERVIEW_DEFAULT_DURATION_MINUTES
          : (duration ?? CODING_INTERVIEW_DEFAULT_DURATION_MINUTES),
        variant: isCodingFocus ? "coding" : "standard",
      });
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
  }, [difficulty, duration, focusArea, isCodingFocus, router]);

  const isReady = !!focusArea && !!difficulty && (isCodingFocus || !!duration);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">专项面试</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              按能力维度进行专项训练，如 HR 面、技术问答和代码题。
            </p>
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        {/* Focus Area */}
        <div className="p-6">
          <label className="mb-3 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            专项方向
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FOCUS_AREAS.map((area) => (
              <FocusAreaCard
                key={area.value}
                area={area}
                selected={focusArea === area.value}
                onClick={() => setFocusArea(area.value)}
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
                      difficulty === d.value
                        ? "text-primary-foreground"
                        : d.color,
                    )}
                  />
                  {d.label}
                </SelectPill>
              );
            })}
          </div>
        </div>

        {!isCodingFocus ? (
          <>
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
          </>
        ) : (
          <div className="mx-6 border-t border-border/60 p-6">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
              代码编程模式默认生成 {CODING_INTERVIEW_QUESTION_COUNT}{" "}
              道题，进入后直接使用专项编码界面作答。
            </div>
          </div>
        )}

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
                开始专项面试
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
          {!isReady && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {isCodingFocus
                ? "请先选择专项方向和面试难度"
                : "请完成上方所有配置后开始"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

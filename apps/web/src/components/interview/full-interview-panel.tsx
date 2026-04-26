"use client";

import { useState, useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Check,
  ChevronsUpDown,
  Loader2,
  Zap,
  BookOpen,
  Trophy,
  Flame,
  Clock,
  ChevronRight,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createInterview,
  type InterviewDifficulty,
} from "@/action/create-interview";
import { buildInterviewHref } from "@/lib/voice-kernel";
import { normalizeInterviewTopic } from "@/lib/interview-session";
import { toast } from "sonner";

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

const TOPIC_OPTIONS = [
  "前端开发",
  "后端开发",
  "全栈开发",
  "移动开发",
  "测试开发",
  "数据分析",
  "算法工程师",
  "产品经理",
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

interface TopicComboboxProps {
  value: string;
  onChange: (value: string) => void;
}

function TopicCombobox({ value, onChange }: TopicComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const normalizedQuery = normalizeInterviewTopic(query);
  const normalizedValue = normalizeInterviewTopic(value);
  const searchableQuery = normalizedQuery.toLocaleLowerCase();
  const filteredOptions = TOPIC_OPTIONS.filter((option) =>
    option.toLocaleLowerCase().includes(searchableQuery),
  );
  const hasExactMatch = TOPIC_OPTIONS.some(
    (option) =>
      normalizeInterviewTopic(option).toLocaleLowerCase() === searchableQuery,
  );

  const commitValue = useCallback(
    (nextValue: string) => {
      const normalizedNextValue = normalizeInterviewTopic(nextValue);
      if (!normalizedNextValue) return;

      onChange(normalizedNextValue);
      setQuery(normalizedNextValue);
      setIsOpen(false);
    },
    [onChange],
  );

  useEffect(() => {
    if (!isOpen) return;

    setQuery(normalizedValue);

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, normalizedValue]);

  return (
    <div ref={containerRef} className={cn("relative", isOpen ? "z-30" : "z-0")}>
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-xl border border-border/80 bg-background px-4 text-left text-base shadow-none transition-colors",
          isOpen
            ? "border-primary ring-2 ring-primary/15"
            : "hover:border-primary/40",
        )}
      >
        <span
          className={cn(
            "truncate",
            normalizedValue ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {normalizedValue || "请选择岗位方向"}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {isOpen ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-50 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xl">
          <div className="border-b border-border/60 px-3 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && normalizedQuery) {
                    event.preventDefault();
                    commitValue(query);
                  }
                }}
                placeholder="搜索岗位方向"
                className="h-9 border-0 bg-transparent pr-3 pl-9 text-sm shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="max-h-52 overflow-y-auto bg-card p-2" role="listbox">
            {filteredOptions.map((option) => {
              const isSelected = normalizedValue === option;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => commitValue(option)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-secondary",
                  )}
                >
                  <span>{option}</span>
                  {isSelected ? <Check className="h-4 w-4" /> : null}
                </button>
              );
            })}

            {normalizedQuery && !hasExactMatch ? (
              <button
                type="button"
                onClick={() => commitValue(query)}
                className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-secondary"
              >
                使用 “{normalizedQuery}”
              </button>
            ) : null}

            {filteredOptions.length === 0 &&
            (!normalizedQuery || hasExactMatch) ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                没有匹配的岗位方向
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FullInterviewPanel() {
  const tPage = useTranslations("dashboard.pages");
  const router = useRouter();

  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<InterviewDifficulty | null>(
    null,
  );
  const [duration, setDuration] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isBusy = isLoading || isPending;
  const normalizedTopic = normalizeInterviewTopic(topic);

  const handleStart = useCallback(async () => {
    if (!normalizedTopic) {
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
      const result = await createInterview({
        topic: normalizedTopic,
        difficulty,
        duration,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.interviewId) {
        startTransition(() => {
          router.push(buildInterviewHref(result.interviewId));
        });
      }
    } catch {
      toast.error("启动面试失败，请重试");
    } finally {
      setIsLoading(false);
    }
  }, [normalizedTopic, difficulty, duration, router]);

  const isReady = !!normalizedTopic && !!difficulty && !!duration;

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
              {tPage("fullInterviewDesc")}
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
          <TopicCombobox value={topic} onChange={setTopic} />
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
        </div>
      </div>
    </div>
  );
}

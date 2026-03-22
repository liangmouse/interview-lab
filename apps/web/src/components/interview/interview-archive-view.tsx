"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  ChevronRight,
  LayoutGrid,
  List,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  getProfileInterviews,
  type ProfileInterviewRecord,
} from "@/action/get-profile-interviews";
import { getInterviewStats } from "@/action/get-interview-stats";
import { MiniRadarChart } from "@/components/interview/mini-radar-chart";

type FilterStatus = "all" | "completed" | "pending";
type ViewMode = "grid" | "list";

function ScoreBadge({ score }: { score: number }) {
  if (score === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
        暂无评分
      </span>
    );
  }

  const isHigh = score >= 80;
  const isMid = score >= 60;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        isHigh
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : isMid
            ? "bg-amber-50 text-amber-700 ring-amber-200"
            : "bg-red-50 text-red-700 ring-red-200",
      )}
    >
      {score}分
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isCompleted = status === "completed";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        isCompleted
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-secondary text-muted-foreground ring-border",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isCompleted ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
      />
      {isCompleted ? "已完成" : "未完成"}
    </span>
  );
}

function InterviewCard({ record }: { record: ProfileInterviewRecord }) {
  return (
    <Link href={`/interview/${record.id}`} className="group block">
      <div className="flex flex-col rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md h-full">
        {/* Top row */}
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {record.type}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{record.date}</p>
          </div>
          <MiniRadarChart scores={record.radarScores} size={64} />
        </div>

        {/* Stats row */}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <ScoreBadge score={record.score} />
          <StatusBadge status={record.status} />
          {record.duration !== "-" && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {record.duration}
            </span>
          )}
        </div>

        {/* Link hint */}
        <div className="mt-3 flex items-center justify-end text-xs text-muted-foreground/60 transition-colors group-hover:text-primary">
          查看详情
          <ChevronRight className="ml-0.5 h-3 w-3" />
        </div>
      </div>
    </Link>
  );
}

function InterviewRow({ record }: { record: ProfileInterviewRecord }) {
  return (
    <Link
      href={`/interview/${record.id}`}
      className="group flex items-center gap-4 rounded-lg border border-border/40 bg-card px-4 py-3.5 transition-all duration-150 hover:border-border/80 hover:bg-secondary/40 hover:shadow-sm"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {record.type}
        </p>
        <p className="text-xs text-muted-foreground">{record.date}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <ScoreBadge score={record.score} />
        <StatusBadge status={record.status} />
        {record.duration !== "-" && (
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
            <Clock className="h-3 w-3" />
            {record.duration}
          </span>
        )}
        <MiniRadarChart scores={record.radarScores} size={48} />
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-primary" />
      </div>
    </Link>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit?: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          color,
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
          {value}
          {unit && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {unit}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-base font-medium text-foreground">暂无面试档案</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        完成一次模拟面试后，你的面试档案将显示在这里
      </p>
      <Button asChild className="mt-6" size="sm">
        <Link href="/interview">开始面试</Link>
      </Button>
    </div>
  );
}

export function InterviewArchiveView() {
  const [records, setRecords] = useState<ProfileInterviewRecord[]>([]);
  const [stats, setStats] = useState<{
    totalInterviews: number;
    avgScore: number;
    totalMinutes: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  useEffect(() => {
    async function load() {
      try {
        const [recordsData, statsData] = await Promise.all([
          getProfileInterviews(),
          getInterviewStats(),
        ]);
        setRecords(recordsData);
        setStats(statsData);
      } catch {
        // silently handle
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const filtered = records.filter((r) => {
    if (filter === "all") return true;
    if (filter === "completed") return r.status === "completed";
    return r.status !== "completed";
  });

  const completedCount = records.filter((r) => r.status === "completed").length;
  const completionRate =
    records.length > 0 ? Math.round((completedCount / records.length) * 100) : 0;

  const formatDuration = (mins: number) => {
    if (mins === 0) return "0";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}`;
    if (m === 0) return `${h}`;
    return `${h}h${m}m`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-5"
            >
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={FileText}
          label="总面试场次"
          value={stats?.totalInterviews ?? 0}
          unit="次"
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon={TrendingUp}
          label="平均评分"
          value={stats?.avgScore ?? 0}
          unit="分"
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon={Clock}
          label="总练习时长"
          value={formatDuration(stats?.totalMinutes ?? 0)}
          unit={
            stats && stats.totalMinutes >= 60
              ? "小时"
              : stats && stats.totalMinutes > 0
                ? "分钟"
                : "分钟"
          }
          color="bg-sky-50 text-sky-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="完成率"
          value={completionRate}
          unit="%"
          color="bg-violet-50 text-violet-600"
        />
      </div>

      {/* Filters + View toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card p-1">
          {(
            [
              { value: "all", label: "全部" },
              { value: "completed", label: "已完成" },
              { value: "pending", label: "未完成" },
            ] as const
          ).map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-150 cursor-pointer",
                filter === f.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "rounded-md p-1.5 transition-colors cursor-pointer",
              viewMode === "grid"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "rounded-md p-1.5 transition-colors cursor-pointer",
              viewMode === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState />
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((record) => (
            <InterviewCard key={record.id} record={record} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((record) => (
            <InterviewRow key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}

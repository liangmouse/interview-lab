"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, TrendingUp, Clock } from "lucide-react";
import {
  getInterviewStats,
  type InterviewStats,
} from "@/action/get-interview-stats";
import { cn } from "@/lib/utils";

/** 格式化时长显示 */
function formatDuration(totalMinutes: number): { value: string; unit: string } {
  if (totalMinutes === 0) return { value: "0", unit: "分钟" };

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return { value: minutes.toString(), unit: "分钟" };
  if (minutes === 0) return { value: hours.toString(), unit: "小时" };
  return { value: `${hours}h ${minutes}m`, unit: "" };
}

export function StatsGrid() {
  const t = useTranslations("dashboard.stats");

  const [stats, setStats] = useState<InterviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 获取统计数据
  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await getInterviewStats();
        setStats(data);
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  // 构建显示数据
  const duration = stats
    ? formatDuration(stats.totalMinutes)
    : { value: "0", unit: "分钟" };

  const displayStats = [
    {
      titleKey: "totalInterviews",
      value: stats?.totalInterviews.toString() ?? "0",
      unit: "次",
      icon: FileText,
      gradient: "from-emerald-500/10 to-emerald-500/5",
      iconColor: "text-emerald-600",
      trend: null,
    },
    {
      titleKey: "avgScore",
      value: stats?.avgScore.toString() ?? "0",
      unit: "分",
      icon: TrendingUp,
      gradient: "from-amber-500/10 to-amber-500/5",
      iconColor: "text-amber-600",
      trend:
        stats && stats.avgScore >= 80
          ? "优秀"
          : stats && stats.avgScore >= 60
            ? "良好"
            : null,
    },
    {
      titleKey: "studyTime",
      value: duration.value,
      unit: duration.unit,
      icon: Clock,
      gradient: "from-sky-500/10 to-sky-500/5",
      iconColor: "text-sky-600",
      trend: null,
    },
  ];

  // 加载状态
  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-32" />
              </div>
              <Skeleton className="h-12 w-12 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {displayStats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.titleKey}
            className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-border/80"
          >
            <div className="flex items-start justify-between relative z-10">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {t(stat.titleKey)}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold tracking-tight text-foreground">
                    {stat.value}
                  </span>
                  {stat.unit && (
                    <span className="text-sm font-medium text-muted-foreground/80">
                      {stat.unit}
                    </span>
                  )}
                </div>
                {stat.trend && (
                  <div className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    {stat.trend}
                  </div>
                )}
              </div>
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
                  stat.gradient,
                  stat.iconColor,
                )}
              >
                <Icon className="h-6 w-6" />
              </div>
            </div>
            {/* Background decoration */}
            <div className="absolute right-0 top-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-gradient-to-br from-current to-transparent opacity-[0.03] blur-2xl" />
          </div>
        );
      })}
    </div>
  );
}

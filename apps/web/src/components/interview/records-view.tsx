"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  TrendingUp,
  Clock,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  getProfileInterviews,
  type ProfileInterviewRecord,
} from "@/action/get-profile-interviews";
import { getInterviewStats } from "@/action/get-interview-stats";
import {
  RADAR_DIMENSIONS,
  toRadarPolygonPoints,
  averageRadarScores,
  type NormalizedRadarScores,
} from "@/lib/interview-radar";

// ── Score Trend Chart ──────────────────────────────────────────────────────────

function ScoreTrendChart({
  records,
}: {
  records: ProfileInterviewRecord[];
}) {
  const width = 480;
  const height = 140;
  const paddingX = 36;
  const paddingTop = 16;
  const paddingBottom = 28;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingTop - paddingBottom;

  const completed = records
    .filter((r) => r.status === "completed" && r.score > 0)
    .slice()
    .reverse(); // chronological

  if (completed.length < 2) {
    return (
      <div className="flex h-[140px] items-center justify-center text-sm text-muted-foreground">
        至少需要 2 次有评分的面试才能展示趋势
      </div>
    );
  }

  const scores = completed.map((r) => r.score);
  const minScore = Math.max(0, Math.min(...scores) - 10);
  const maxScore = Math.min(100, Math.max(...scores) + 10);
  const range = maxScore - minScore || 1;

  const points = completed.map((r, i) => {
    const x = paddingX + (i / (completed.length - 1)) * chartW;
    const y = paddingTop + chartH - ((r.score - minScore) / range) * chartH;
    return { x, y, score: r.score, date: r.date };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // Area fill path
  const areaPath = [
    `M ${points[0].x.toFixed(1)},${(paddingTop + chartH).toFixed(1)}`,
    ...points.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L ${points[points.length - 1].x.toFixed(1)},${(paddingTop + chartH).toFixed(1)}`,
    "Z",
  ].join(" ");

  // Y-axis ticks
  const yTicks = [minScore, Math.round((minScore + maxScore) / 2), maxScore];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      aria-label="分数趋势图"
    >
      {/* Grid lines */}
      {yTicks.map((tick) => {
        const y = paddingTop + chartH - ((tick - minScore) / range) * chartH;
        return (
          <g key={tick}>
            <line
              x1={paddingX}
              y1={y}
              x2={width - paddingX}
              y2={y}
              stroke="hsl(160 10% 90%)"
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <text
              x={paddingX - 6}
              y={y + 4}
              textAnchor="end"
              fontSize={9}
              fill="hsl(160 10% 50%)"
            >
              {tick}
            </text>
          </g>
        );
      })}

      {/* X-axis labels */}
      {completed.map((r, i) => {
        const x = paddingX + (i / (completed.length - 1)) * chartW;
        const shortDate = r.date.replace(/\d{4}\//, "");
        return (
          <text
            key={r.id}
            x={x}
            y={height - 4}
            textAnchor="middle"
            fontSize={9}
            fill="hsl(160 10% 50%)"
          >
            {shortDate}
          </text>
        );
      })}

      {/* Area fill */}
      <path
        d={areaPath}
        fill="hsl(161 94% 30% / 0.08)"
      />

      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke="hsl(161 94% 30%)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="white" stroke="hsl(161 94% 30%)" strokeWidth={2} />
          <circle cx={p.x} cy={p.y} r={2} fill="hsl(161 94% 30%)" />
        </g>
      ))}
    </svg>
  );
}

// ── Full Radar Chart ───────────────────────────────────────────────────────────

function FullRadarChart({ scores }: { scores: NormalizedRadarScores }) {
  const size = 200;
  const padding = 32;
  const center = size / 2;
  const radius = center - padding;
  const n = RADAR_DIMENSIONS.length;

  const axes = RADAR_DIMENSIONS.map((d, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
      labelX: center + Math.cos(angle) * (radius + 18),
      labelY: center + Math.sin(angle) * (radius + 18),
      label: d.label,
    };
  });

  const rings = [0.25, 0.5, 0.75, 1].map((ratio) =>
    RADAR_DIMENSIONS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
      const r = radius * ratio;
      return `${(center + Math.cos(angle) * r).toFixed(1)},${(center + Math.sin(angle) * r).toFixed(1)}`;
    }).join(" "),
  );

  const scoreValues = RADAR_DIMENSIONS.map((d) => scores[d.key]);
  const dataPoints = toRadarPolygonPoints(scoreValues, size, padding);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label="综合能力雷达图"
    >
      {/* Rings */}
      {rings.map((ring, i) => (
        <polygon
          key={i}
          points={ring}
          fill={i === 3 ? "none" : "none"}
          stroke="hsl(160 10% 88%)"
          strokeWidth={i === 3 ? 1 : 0.75}
        />
      ))}

      {/* Axes */}
      {axes.map((ax, i) => (
        <line
          key={i}
          x1={center}
          y1={center}
          x2={ax.x}
          y2={ax.y}
          stroke="hsl(160 10% 88%)"
          strokeWidth={0.75}
        />
      ))}

      {/* Data polygon */}
      {dataPoints && (
        <>
          <polygon
            points={dataPoints}
            fill="hsl(161 94% 30% / 0.15)"
            stroke="hsl(161 94% 30%)"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {RADAR_DIMENSIONS.map((d, i) => {
            const ratio = scores[d.key] / 100;
            const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
            const x = center + Math.cos(angle) * radius * ratio;
            const y = center + Math.sin(angle) * radius * ratio;
            return (
              <circle key={d.key} cx={x} cy={y} r={3} fill="hsl(161 94% 30%)" />
            );
          })}
        </>
      )}

      {/* Labels */}
      {axes.map((ax, i) => (
        <text
          key={i}
          x={ax.labelX}
          y={ax.labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill="hsl(160 40% 30%)"
          fontWeight={500}
        >
          {ax.label}
        </text>
      ))}
    </svg>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

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

// ── Dimension Score Row ───────────────────────────────────────────────────────

function DimensionRow({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  const isHigh = score >= 80;
  const isMid = score >= 60;
  const barColor = isHigh
    ? "bg-emerald-500"
    : isMid
      ? "bg-amber-500"
      : "bg-red-400";

  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 overflow-hidden rounded-full bg-secondary h-1.5">
        <div
          className={cn("h-full rounded-full transition-all duration-700", barColor)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span
        className={cn(
          "w-8 text-right text-xs font-semibold",
          isHigh
            ? "text-emerald-600"
            : isMid
              ? "text-amber-600"
              : "text-red-500",
        )}
      >
        {score}
      </span>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
        <BarChart3 className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-base font-medium text-foreground">暂无面试记录</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        完成至少一次模拟面试，这里将展示你的表现趋势与能力分布
      </p>
      <Button asChild className="mt-6" size="sm">
        <Link href="/interview">开始第一次面试</Link>
      </Button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RecordsView() {
  const [records, setRecords] = useState<ProfileInterviewRecord[]>([]);
  const [stats, setStats] = useState<{
    totalInterviews: number;
    avgScore: number;
    totalMinutes: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl border bg-card p-5">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (records.length === 0) {
    return <EmptyState />;
  }

  const formatDuration = (mins: number) => {
    if (mins === 0) return "0";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}`;
    if (m === 0) return `${h}`;
    return `${h}h${m}m`;
  };

  const durationUnit =
    stats && stats.totalMinutes >= 60
      ? "小时"
      : "分钟";

  // Aggregate radar
  const radarSourceList = records.map((r) => r.radarScores);
  const avgRadar: NormalizedRadarScores = averageRadarScores(radarSourceList);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={FileText}
          label="总面试次数"
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
          unit={durationUnit}
          color="bg-sky-50 text-sky-600"
        />
      </div>

      {/* Score Trend */}
      <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">分数趋势</h3>
        <ScoreTrendChart records={records} />
      </div>

      {/* Radar + Dimension breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">综合能力分布</h3>
          <div className="flex items-center justify-center">
            <FullRadarChart scores={avgRadar} />
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">各维度均值</h3>
          <div className="space-y-4 pt-2">
            {RADAR_DIMENSIONS.map((d) => (
              <DimensionRow
                key={d.key}
                label={d.label}
                score={avgRadar[d.key]}
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            基于 {records.length} 场面试的综合统计
          </p>
        </div>
      </div>

      {/* History Table */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="border-b border-border/60 px-6 py-4">
          <h3 className="text-sm font-semibold text-foreground">历史记录</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 text-xs uppercase tracking-widest text-muted-foreground">
                <th className="px-6 py-3 text-left font-medium">日期</th>
                <th className="px-6 py-3 text-left font-medium">类型</th>
                <th className="px-6 py-3 text-left font-medium">评分</th>
                <th className="px-6 py-3 text-left font-medium">时长</th>
                <th className="px-6 py-3 text-left font-medium">状态</th>
                <th className="px-6 py-3 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const isCompleted = r.status === "completed";
                const isHigh = r.score >= 80;
                const isMid = r.score >= 60;
                return (
                  <tr
                    key={r.id}
                    className="group border-b border-border/40 transition-colors last:border-0 hover:bg-secondary/40"
                  >
                    <td className="px-6 py-3.5 text-sm text-foreground">
                      {r.date}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-foreground">
                      {r.type}
                    </td>
                    <td className="px-6 py-3.5">
                      {r.score > 0 ? (
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
                          {r.score}分
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-sm text-muted-foreground">
                      {r.duration}
                    </td>
                    <td className="px-6 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-medium",
                          isCompleted ? "text-emerald-600" : "text-muted-foreground",
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
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        href={`/interview/${r.id}`}
                        className="inline-flex items-center gap-0.5 text-xs text-muted-foreground/60 transition-colors group-hover:text-primary"
                      >
                        查看
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

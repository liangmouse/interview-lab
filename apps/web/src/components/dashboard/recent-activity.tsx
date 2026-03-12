"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import Link from "next/link";
import { getRecentInterviews } from "@/action/get-recent-interviews";
import type { InterviewRecord } from "@/types/interview";
import { Skeleton } from "@/components/ui/skeleton";

/** 面试类型映射 */
const typeLabels: Record<string, string> = {
  frontend: "前端开发",
  backend: "后端开发",
  fullstack: "全栈开发",
  mobile: "客户端开发",
};

export function RecentActivity() {
  const t = useTranslations("dashboard");
  const tTable = useTranslations("dashboard.table");

  const [activities, setActivities] = useState<InterviewRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 获取最近面试记录
  useEffect(() => {
    async function fetchActivities() {
      try {
        const data = await getRecentInterviews();
        setActivities(data);
      } catch (err) {
        console.error("Failed to fetch recent activities:", err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchActivities();
  }, []);

  // 加载状态
  if (isLoading) {
    return (
      <div className="rounded-lg border border-[#E5E5E5] bg-white shadow-sm">
        <div className="border-b border-[#E5E5E5] px-8 py-6">
          <h2 className="text-xl font-light text-[#141414]">
            {t("recentHistory")}
          </h2>
        </div>
        <div className="p-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 当前面试记录为空
  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-[#E5E5E5] bg-white shadow-sm">
        <div className="border-b border-[#E5E5E5] px-8 py-6">
          <h2 className="text-xl font-light text-[#141414]">
            {t("recentHistory")}
          </h2>
        </div>
        <div className="flex flex-col items-center justify-center py-16 px-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F5F5F5] mb-4">
            <FileText className="h-8 w-8 text-[#999999]" />
          </div>
          <p className="text-base text-[#666666] mb-1">暂无面试记录</p>
          <p className="text-sm text-[#999999]">
            开始您的第一次模拟面试，记录将显示在这里
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white shadow-sm">
      <div className="border-b border-[#E5E5E5] px-8 py-6">
        <h2 className="text-xl font-light text-[#141414]">
          {t("recentHistory")}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E5E5E5] text-xs uppercase tracking-wide text-[#666666]">
              <th className="px-8 py-4 text-left font-normal">
                {tTable("date")}
              </th>
              <th className="px-8 py-4 text-left font-normal">
                {tTable("role")}
              </th>
              <th className="px-8 py-4 text-left font-normal">
                {tTable("score")}
              </th>
              <th className="px-8 py-4 text-left font-normal">
                {tTable("status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
              <tr
                key={activity.id}
                className="border-b border-[#E5E5E5] transition-colors hover:bg-[#FDFCF8] cursor-pointer"
              >
                <td className="px-8 py-4 text-sm text-[#141414]">
                  <Link
                    href={`/interview/${activity.id}`}
                    className="block w-full"
                  >
                    {activity.date}
                  </Link>
                </td>
                <td className="px-8 py-4 text-sm text-[#141414]">
                  <Link
                    href={`/interview/${activity.id}`}
                    className="block w-full"
                  >
                    {typeLabels[activity.type] || activity.type}
                  </Link>
                </td>
                <td className="px-8 py-4 text-sm text-[#141414]">
                  <Link
                    href={`/interview/${activity.id}`}
                    className="block w-full"
                  >
                    {activity.score}/100
                  </Link>
                </td>
                <td className="px-8 py-4">
                  <Link
                    href={`/interview/${activity.id}`}
                    className="block w-full"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${activity.status === "completed" ? "bg-[#0F3E2E]" : "bg-[#666666]"}`}
                      />
                      <span className="text-sm capitalize text-[#666666]">
                        {tTable(activity.status as "completed" | "pending")}
                      </span>
                    </div>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

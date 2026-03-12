"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export interface InterviewStats {
  /** 总面试次数 */
  totalInterviews: number;
  /** 平均分数 */
  avgScore: number;
  /** 总学习时长（分钟） */
  totalMinutes: number;
}

/**
 * 获取用户的面试统计数据
 */
export async function getInterviewStats(): Promise<InterviewStats> {
  const defaultStats: InterviewStats = {
    totalInterviews: 0,
    avgScore: 0,
    totalMinutes: 0,
  };

  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    return defaultStats;
  }

  try {
    // 获取用户的 profile id
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching user profile:", profileError);
      return defaultStats;
    }

    // 获取用户的所有面试记录
    const { data: interviews, error } = await supabase
      .from("interviews")
      .select("score, duration, status")
      .eq("user_id", profile.id);

    if (error) {
      console.error("Error fetching interview stats:", error);
      return defaultStats;
    }

    if (!interviews || interviews.length === 0) {
      return defaultStats;
    }

    // 计算统计数据
    const totalInterviews = interviews.length;

    // 计算平均分（只计算已完成且有分数的面试）
    const completedWithScore = interviews.filter(
      (i) => i.status === "completed" && i.score && i.score > 0,
    );
    const avgScore =
      completedWithScore.length > 0
        ? Math.round(
            completedWithScore.reduce((sum, i) => sum + (i.score || 0), 0) /
              completedWithScore.length,
          )
        : 0;

    // 计算总时长（解析 duration 字段，格式可能是 "30分钟" 或 "1h 30m" 或纯数字）
    let totalMinutes = 0;
    for (const interview of interviews) {
      if (interview.duration) {
        const duration = interview.duration.toString();
        // 尝试解析不同格式
        const hourMatch = duration.match(/(\d+)\s*h/i);
        const minMatch = duration.match(/(\d+)\s*m/i);
        const zhMinMatch = duration.match(/(\d+)\s*分/);

        if (hourMatch) {
          totalMinutes += parseInt(hourMatch[1]) * 60;
        }
        if (minMatch) {
          totalMinutes += parseInt(minMatch[1]);
        }
        if (zhMinMatch) {
          totalMinutes += parseInt(zhMinMatch[1]);
        }
        // 如果是纯数字，假设是分钟
        if (/^\d+$/.test(duration)) {
          totalMinutes += parseInt(duration);
        }
      }
    }

    return {
      totalInterviews,
      avgScore,
      totalMinutes,
    };
  } catch (error) {
    console.error("Unexpected error fetching interview stats:", error);
    return defaultStats;
  }
}

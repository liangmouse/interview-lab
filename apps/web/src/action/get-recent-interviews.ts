"use server";

import { InterviewRecord } from "@/types/interview";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export async function getRecentInterviews(): Promise<InterviewRecord[]> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  try {
    // 先获取用户的 profile id（interviews.user_id 关联 user_profiles.id）
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching user profile:", profileError);
      return [];
    }

    const { data, error } = await supabase
      .from("interviews")
      .select("id, date, type, score, duration, status")
      .eq("user_id", profile.id)
      .order("date", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error fetching recent interviews:", error);
      return [];
    }

    // 确保数据格式正确
    const formattedData = (data || []).map((item) => {
      let displayType = item.type || "练习模式";
      if (item.type && item.type.includes(":")) {
        const [topic, diff] = item.type.split(":");
        // 简单的映射或直接显示
        displayType = `${topic} (${diff})`;
      }

      return {
        id: item.id,
        date: item.date ? new Date(item.date).toLocaleDateString("zh-CN") : "",
        type: displayType,
        score: item.score || 0,
        duration: item.duration ? `${item.duration}分钟` : "未知",
        status: item.status || "pending",
      };
    });

    return formattedData;
  } catch (error) {
    console.error("Unexpected error fetching recent interviews:", error);
    return [];
  }
}

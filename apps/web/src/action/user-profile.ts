"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";
import type { UserProfile, UserProfileFormData } from "@/types/profile";

export async function getOrCreateUserProfile(
  user: User,
): Promise<UserProfile | null> {
  const supabase = await createClient();

  try {
    // 检查用户个人资料是否存在
    const { data: existingProfile, error: selectError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (selectError && selectError.code !== "PGRST116") {
      // PGRST116 表示没有找到记录，这不是一个需要抛出的错误
      console.error("Error fetching user profile:", selectError);
    }

    if (existingProfile) {
      return existingProfile;
    }

    // 如果不存在，则创建新的用户个人资料
    const newUserProfile: Partial<UserProfile> = {
      user_id: user.id,
      avatar_url: user.user_metadata?.avatar_url || null,
    };

    const { data: newProfile, error: insertError } = await supabase
      .from("user_profiles")
      .insert(newUserProfile)
      .select("*")
      .single();

    if (insertError) {
      // 如果是唯一约束冲突（用户已存在但查询失败），尝试再次查询
      if (insertError.code === "23505") {
        const { data: retryProfile } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
        if (retryProfile) {
          return retryProfile;
        }
      }
      console.error("Error creating user profile:", insertError);
      // 不抛出错误，返回 null，让调用者决定如何处理
      return null;
    }

    return newProfile;
  } catch (error) {
    console.error("An unexpected error occurred:", error);
    // 不抛出错误，返回 null
    return null;
  }
}

/**
 * 更新用户个人资料
 */
export async function updateUserProfile(
  data: UserProfileFormData,
): Promise<{ profile?: UserProfile; error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    return { error: "请先登录" };
  }

  try {
    // 构建更新数据
    const updateData: Record<string, unknown> = {};

    if (data.nickname !== undefined) updateData.nickname = data.nickname;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.job_intention !== undefined)
      updateData.job_intention = data.job_intention;
    if (data.company_intention !== undefined)
      updateData.company_intention = data.company_intention;
    if (data.experience_years !== undefined)
      updateData.experience_years = data.experience_years;
    if (data.graduation_date !== undefined)
      updateData.graduation_date = data.graduation_date;
    if (data.work_experiences !== undefined)
      updateData.work_experiences = data.work_experiences;
    if (data.project_experiences !== undefined)
      updateData.project_experiences = data.project_experiences;
    if (data.resume_url !== undefined) updateData.resume_url = data.resume_url;

    // 处理 skills 字段（字符串转数组）
    if (data.skills !== undefined) {
      updateData.skills = data.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // 更新数据库
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .update(updateData)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      console.error("Error updating user profile:", error);
      return { error: "更新失败，请重试" };
    }

    return { profile };
  } catch (error) {
    console.error("Unexpected error updating user profile:", error);
    return { error: "更新失败，请重试" };
  }
}

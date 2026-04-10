"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { resolveUserAccessForUserId } from "@/lib/billing/access";
import type { PersonalizationMode } from "@/types/billing";
import {
  buildInterviewType,
  type InterviewDifficulty,
  type InterviewSessionVariant,
  type InterviewTopic,
} from "@/lib/interview-session";

export type { InterviewTopic, InterviewDifficulty, InterviewSessionVariant };

/** 创建面试的参数 */
export interface CreateInterviewParams {
  /** 面试主题 */
  topic: InterviewTopic;
  /** 面试难度 */
  difficulty: InterviewDifficulty;
  /** 面试时长（分钟） */
  duration: number;
  /** 面试个性化模式 */
  personalizationMode?: PersonalizationMode;
  /** 面试变体 */
  variant?: InterviewSessionVariant;
}

/**
 * 创建面试会话
 * @param params 面试配置（主题、难度）
 * @returns 面试 ID 或错误信息
 */
export async function createInterview(params: CreateInterviewParams) {
  const {
    topic,
    difficulty,
    duration,
    personalizationMode = "generic",
    variant = "standard",
  } = params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "请先登录" };
  }

  const access = await resolveUserAccessForUserId(user.id, supabase);
  const requiresPremium = personalizationMode !== "generic";

  if (requiresPremium && !access.canUsePersonalization) {
    return { error: "简历/JD 定制面试需要会员权限，请先升级" };
  }

  let consumedTrial = false;
  if (!requiresPremium && access.tier !== "premium") {
    const { data: trialResult, error: trialError } = await supabase.rpc(
      "consume_trial_if_available",
      {
        p_user_id: user.id,
      },
    );

    if (trialError) {
      console.error("Error consuming interview trial:", trialError);
      return { error: "校验试用次数失败，请重试" };
    }

    if (!trialResult?.allowed) {
      return { error: "免费试用次数已用完，请升级会员后继续" };
    }

    consumedTrial = true;
  }

  // 查找用户的 profile id（interviews 表的 user_id 关联 user_profiles.id）
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    console.error("Error finding user profile:", profileError);

    if (consumedTrial) {
      await supabase.rpc("compensate_trial_consumption", {
        p_user_id: user.id,
      });
    }

    return { error: "用户资料不存在，请先完善个人信息" };
  }

  // 创建面试会话
  const { data, error } = await supabase
    .from("interviews")
    .insert([
      {
        user_id: profile.id,
        type: buildInterviewType({ topic, difficulty, variant }),
        status: "pending",
        // duration 字段存储实际时长
        duration: duration.toString(),
      },
    ])
    .select("id")
    .single();

  if (error) {
    console.error("Error creating interview:", error);

    if (consumedTrial) {
      await supabase.rpc("compensate_trial_consumption", {
        p_user_id: user.id,
      });
    }

    return { error: "创建面试失败，请重试" };
  }

  revalidatePath("/dashboard");

  return { interviewId: data.id };
}

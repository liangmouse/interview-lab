import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ProfileData {
  user_id: string;
  nickname: string;
  bio: string;
  job_intention: string;
  company_intention: string;
  skills: string[];
  experience_years: number;
  graduation_date?: string;
  work_experiences?: any[];
  project_experiences?: any[];
  resume_url?: string;
  avatar_url: string;
  updated_at: string;
  created_at?: string;
}

export async function GET() {
  try {
    const supabase = await createClient();

    // 获取当前用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 获取用户资料
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching profile:", error);
      return NextResponse.json({ error: "获取用户资料失败" }, { status: 500 });
    }

    return NextResponse.json({ data: data || null });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 获取当前用户
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = await request.json();

    // 获取现有用户资料（如果存在）
    const { data: existingProfile, error: fetchError } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const isFirstCreate = fetchError?.code === "PGRST116" || !existingProfile;

    // 合并现有资料和请求体数据
    // 原则：请求体中提供的字段优先，未提供的字段使用现有值
    // 这样即使单独上传头像后，保存其他资料时也会自动保留数据库中的最新头像

    // 辅助函数：如果请求体中有值则使用，否则使用现有值或默认值
    const getValue = <T>(
      requestValue: T | undefined,
      existingValue: T | null | undefined,
      defaultValue: T,
    ): T => {
      return requestValue !== undefined
        ? requestValue
        : (existingValue ?? defaultValue);
    };

    const profileData: ProfileData = {
      user_id: user.id,
      nickname: getValue(body.nickname, existingProfile?.nickname, ""),
      bio: getValue(body.bio, existingProfile?.bio, ""),
      job_intention: getValue(
        body.job_intention,
        existingProfile?.job_intention,
        "",
      ),
      company_intention: getValue(
        body.company_intention,
        existingProfile?.company_intention,
        "",
      ),
      // 如果请求体中有 skills，确保它是数组；否则使用现有值或默认值
      skills:
        body.skills !== undefined
          ? Array.isArray(body.skills)
            ? body.skills
            : []
          : (existingProfile?.skills ?? []),
      // 如果请求体中有 experience_years，解析它；否则使用现有值或默认值
      experience_years:
        body.experience_years !== undefined
          ? parseInt(String(body.experience_years)) || 0
          : (existingProfile?.experience_years ?? 0),
      graduation_date: getValue(
        body.graduation_date,
        existingProfile?.graduation_date,
        "",
      ),
      work_experiences: getValue(
        body.work_experiences,
        existingProfile?.work_experiences,
        [],
      ),
      project_experiences: getValue(
        body.project_experiences,
        existingProfile?.project_experiences,
        [],
      ),
      resume_url: getValue(body.resume_url, existingProfile?.resume_url, ""),
      // avatar_url 自动从数据库获取最新值（如果请求体中没有提供）
      // 这样即使单独上传头像后，保存其他资料时也会自动保留数据库中的最新头像
      avatar_url: getValue(
        body.avatar_url,
        existingProfile?.avatar_url || user.user_metadata?.avatar_url || null,
        "",
      ),
      updated_at: new Date().toISOString(),
    };

    // 如果是第一次创建，添加created_at
    if (isFirstCreate) {
      profileData.created_at = new Date().toISOString();
    }

    // 更新或插入用户资料
    const { data, error } = await supabase
      .from("user_profiles")
      .upsert(profileData, { onConflict: "user_id" })
      .select()
      .single();

    if (error) {
      console.error("Error saving profile:", error);
      return NextResponse.json({ error: "保存用户资料失败" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

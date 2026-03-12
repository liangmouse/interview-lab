import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/types/profile";

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    const supabase = await createClient();

    // 1. 获取当前认证用户 (仅检查 Cookie，速度快)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    // 2. 只有已登录用户才查询详细 Profile
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    return data;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

"use server";

import { deleteResumeRecordByStoragePath } from "@interviewclaw/data-access";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

interface DeleteResumeResult {
  success: boolean;
  error?: string;
}

function normalizeResumeUrl(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

export async function deleteResume(
  filePath: string,
): Promise<DeleteResumeResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "请先登录" };
  }

  if (!filePath || !filePath.startsWith(`${user.id}/`)) {
    return { success: false, error: "无效的简历文件路径" };
  }

  const supabase = await createClient();

  try {
    const { error: removeError } = await supabase.storage
      .from("resumes")
      .remove([filePath]);

    if (removeError) {
      console.error("Error deleting resume from storage:", removeError);
      return { success: false, error: "删除失败，请稍后重试" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("resume_url")
      .eq("user_id", user.id)
      .single();

    if (!profileError && profile?.resume_url) {
      const normalizedUrl = normalizeResumeUrl(profile.resume_url);
      if (normalizedUrl.includes(`/resumes/${filePath}`)) {
        const { error: updateError } = await supabase
          .from("user_profiles")
          .update({ resume_url: null })
          .eq("user_id", user.id);

        if (updateError) {
          console.warn(
            "Failed to clear profile resume_url after deletion:",
            updateError,
          );
        }
      }
    }

    await deleteResumeRecordByStoragePath(user.id, filePath);

    return { success: true };
  } catch (error) {
    console.error("Unexpected error deleting resume:", error);
    return { success: false, error: "删除失败，请稍后重试" };
  }
}

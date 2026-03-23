"use server";

import { upsertResumeRecord } from "@interviewclaw/data-access";
import { createClient } from "@/lib/supabase/server";
import { userProfileService } from "@/lib/user-profile-service";
import { logResumeStage } from "@/lib/resume-parsing-logger";
import type { UserProfile } from "@/types/profile";

export type ResumeProcessingStatus =
  | "idle"
  | "uploaded"
  | "processing"
  | "completed"
  | "failed";

export interface UploadResumeResult {
  success: boolean;
  error?: string;
  data?: UserProfile;
  storagePath?: string;
  resumeUrl?: string;
  resumeProcessingStatus?: ResumeProcessingStatus;
}

export async function uploadResume(
  formData: FormData,
): Promise<UploadResumeResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { success: false, error: "No file provided" };
    }

    logResumeStage.upload("开始上传简历文件", {
      fileName: file.name,
      fileSize: file.size,
    });

    const uploadedResume = await userProfileService.uploadResumeFile(
      user.id,
      file,
    );
    if (!uploadedResume.success || !uploadedResume.storagePath) {
      return {
        success: false,
        error: uploadedResume.error || "简历上传失败",
      };
    }

    await upsertResumeRecord(
      {
        userId: user.id,
        storagePath: uploadedResume.storagePath,
        fileUrl: uploadedResume.resumeUrl || "",
        fileName: file.name,
        processingStatus: "uploaded",
      },
      supabase,
    );

    const { data, error } = await supabase
      .from("user_profiles")
      .update({
        resume_url: uploadedResume.resumeUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error || !data) {
      logResumeStage.error("数据库更新", "简历上传后更新资料失败", error);
      return {
        success: false,
        error: `Profile update error: ${error?.message || "unknown error"}`,
      };
    }

    logResumeStage.upload("简历上传完成，后台解析待启动", {
      userId: user.id,
      storagePath: uploadedResume.storagePath,
    });

    return {
      success: true,
      data,
      storagePath: uploadedResume.storagePath,
      resumeUrl: uploadedResume.resumeUrl,
      resumeProcessingStatus: "uploaded",
    };
  } catch (error) {
    console.error("Upload resume error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "上传简历失败",
    };
  }
}

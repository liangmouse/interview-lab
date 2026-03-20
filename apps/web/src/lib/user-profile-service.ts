import { createClient } from "@/lib/supabase/server";
import {
  profileToVectorDocuments,
  storeVectorDocuments,
} from "@/lib/vector-rag";
import type { UserProfile } from "@/types/profile";
import type { ResumeData } from "@/lib/resume-processing-service";
import { logResumeStage, resumeLogger } from "@/lib/resume-parsing-logger";

interface ProcessResumeInput {
  userId: string;
  resumeUrl: string;
  analyzeData: ResumeData;
}

function buildProfileUpdateData(
  analyzeData: ResumeData,
  resumeUrl: string,
): Record<string, unknown> {
  logResumeStage.dataMapping("开始数据映射", {
    hasWorkExperiences: !!analyzeData.workExperiences,
    workExperiencesCount: analyzeData.workExperiences?.length || 0,
  });

  const profileUpdateData = {
    nickname: analyzeData.personalInfo?.name,
    email: analyzeData.personalInfo?.email,
    job_intention: analyzeData.jobIntention,
    experience_years: analyzeData.experienceYears,
    skills: analyzeData.skills,
    school: analyzeData.education?.school,
    major: analyzeData.education?.major,
    degree: analyzeData.education?.degree,
    graduation_date: analyzeData.education?.graduationDate,
    work_experiences: analyzeData.workExperiences?.map((exp) => ({
      company: exp.company,
      position: exp.position,
      start_date: exp.startDate || "",
      end_date: exp.endDate || "",
      description: exp.description,
    })),
    project_experiences: analyzeData.projectExperiences?.map((proj) => ({
      project_name: proj.projectName,
      role: proj.role || "",
      start_date: proj.startDate,
      end_date: proj.endDate,
      tech_stack: proj.techStack,
      description: proj.description,
    })),
    resume_url: resumeUrl,
    updated_at: new Date().toISOString(),
  };

  if (profileUpdateData.work_experiences) {
    logResumeStage.dataMapping("工作经历映射完成", {
      count: profileUpdateData.work_experiences.length,
      data: profileUpdateData.work_experiences,
    });
  } else {
    resumeLogger.warn("数据映射", "工作经历映射结果为空");
  }

  const filteredData = Object.fromEntries(
    Object.entries(profileUpdateData).filter(
      ([, value]) => value !== undefined && value !== null,
    ),
  );

  logResumeStage.dataMapping("过滤后的数据", {
    hasWorkExperiences: !!filteredData.work_experiences,
    workExperiencesCount: Array.isArray(filteredData.work_experiences)
      ? filteredData.work_experiences.length
      : 0,
    fields: Object.keys(filteredData),
  });

  return filteredData;
}

/**
 * 用户档案服务
 * 负责用户档案的向量化和个性化处理
 */
export class UserProfileService {
  private getSupabase() {
    return createClient();
  }

  /**
   * 上传简历文件
   */
  async uploadResumeFile(
    userId: string,
    file: File,
  ): Promise<{
    success: boolean;
    error?: string;
    storagePath?: string;
    resumeUrl?: string;
  }> {
    try {
      const supabase = await this.getSupabase();
      const storagePath = `${userId}/${crypto.randomUUID()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(storagePath, file, { contentType: "application/pdf" });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return {
          success: false,
          error: `Storage error: ${uploadError.message}`,
        };
      }

      const { data } = supabase.storage
        .from("resumes")
        .getPublicUrl(storagePath);

      return {
        success: true,
        storagePath,
        resumeUrl: data.publicUrl,
      };
    } catch (error) {
      console.error("上传简历文件失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "上传简历文件失败",
      };
    }
  }

  /**
   * 向量化用户档案
   */
  async vectorizeUserProfile(userId: string): Promise<{
    success: boolean;
    error?: string;
    documentCount?: number;
  }> {
    try {
      // 获取用户档案
      const supabase = await this.getSupabase();
      const { data: userProfile, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (profileError || !userProfile) {
        return {
          success: false,
          error: "用户档案不存在",
        };
      }

      // 转换为向量文档
      const documents = await profileToVectorDocuments(userProfile);

      // 存储到向量数据库
      await storeVectorDocuments(documents, userId);

      return {
        success: true,
        documentCount: documents.length,
      };
    } catch (error) {
      console.error("向量化用户档案失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  }

  async processResumeAndVectorize(input: ProcessResumeInput): Promise<{
    success: boolean;
    error?: string;
    profile?: UserProfile;
    documentCount?: number;
  }> {
    try {
      const supabase = await this.getSupabase();
      const dbSafeData = buildProfileUpdateData(
        input.analyzeData,
        input.resumeUrl,
      );

      logResumeStage.dbUpdate("开始更新数据库", {
        userId: input.userId,
        fieldsToUpdate: Object.keys(dbSafeData),
        note: "后台解析流程更新核心字段",
      });

      const { data: profile, error } = await supabase
        .from("user_profiles")
        .update(dbSafeData)
        .eq("user_id", input.userId)
        .select("*")
        .single();

      if (error || !profile) {
        logResumeStage.error("数据库更新", "更新失败", error);
        return {
          success: false,
          error: error?.message || "更新用户资料失败",
        };
      }

      logResumeStage.dbUpdate("数据库更新成功", {
        hasWorkExperiences: !!profile.work_experiences,
        workExperiencesCount: profile.work_experiences?.length || 0,
      });

      try {
        logResumeStage.vectorization("开始向量化用户档案", {
          userId: input.userId,
        });
        const documents = await profileToVectorDocuments(profile);
        await storeVectorDocuments(documents, input.userId);
        logResumeStage.vectorization("向量化用户档案完成", {
          userId: input.userId,
          documentCount: documents.length,
        });
        return {
          success: true,
          profile,
          documentCount: documents.length,
        };
      } catch (vectorizeError) {
        logResumeStage.error("向量化", "向量化用户档案失败", vectorizeError);
        return {
          success: true,
          profile,
        };
      }
    } catch (error) {
      console.error("处理简历并向量化失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "处理简历并向量化失败",
      };
    }
  }

  /**
   * 检查用户档案是否已向量化
   */
  async isProfileVectorized(userId: string): Promise<boolean> {
    try {
      const supabase = await this.getSupabase();
      const { data, error } = await supabase.rpc(
        "get_user_profile_vector_stats",
        {
          p_user_id: userId,
        },
      );

      if (error) {
        console.error("检查向量化状态失败:", error);
        return false;
      }

      return data?.total_vectors > 0;
    } catch (error) {
      console.error("检查向量化状态失败:", error);
      return false;
    }
  }

  /**
   * 清理用户档案向量
   */
  async clearUserProfileVectors(userId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const supabase = await this.getSupabase();
      const { error } = await supabase.rpc("clear_user_profile_vectors", {
        p_user_id: userId,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return { success: true };
    } catch (error) {
      console.error("清理用户档案向量失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  }

  /**
   * 重新向量化用户档案（先清理再向量化）
   */
  async revectorizeUserProfile(userId: string): Promise<{
    success: boolean;
    error?: string;
    documentCount?: number;
  }> {
    try {
      // 先清理现有向量
      const clearResult = await this.clearUserProfileVectors(userId);
      if (!clearResult.success) {
        return clearResult;
      }

      // 重新向量化
      return await this.vectorizeUserProfile(userId);
    } catch (error) {
      console.error("重新向量化用户档案失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  }

  /**
   * 获取用户档案向量统计
   */
  async getUserProfileVectorStats(userId: string): Promise<{
    success: boolean;
    stats?: any;
    error?: string;
  }> {
    try {
      const supabase = await this.getSupabase();
      const { data, error } = await supabase.rpc(
        "get_user_profile_vector_stats",
        {
          p_user_id: userId,
        },
      );

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        stats: data,
      };
    } catch (error) {
      console.error("获取用户档案向量统计失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  }
}

// 导出单例实例
export const userProfileService = new UserProfileService();

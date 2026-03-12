import { createClient } from "@/lib/supabase/server";
import {
  profileToVectorDocuments,
  storeVectorDocuments,
} from "@/lib/vector-rag";

/**
 * 用户档案服务
 * 负责用户档案的向量化和个性化处理
 */
export class UserProfileService {
  private getSupabase() {
    return createClient();
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

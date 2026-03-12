import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  profileToVectorDocuments,
  storeVectorDocuments,
  executeRAGPipeline,
} from "@/lib/vector-rag";
import {
  extractPersonalizedContext,
  generatePersonalizedInterviewPrompt,
} from "@/lib/profile-rag";
import { userProfileService } from "@/lib/user-profile-service";

/**
 * 用户档案向量化API
 * POST /api/profile/vectorize
 *
 * 将用户档案数据转换为向量并存储到pgvector数据库
 */
export async function POST(request: NextRequest) {
  try {
    const { userProfile, action = "vectorize" } = await request.json();

    if (!userProfile || !userProfile.user_id) {
      return NextResponse.json({ error: "用户档案数据无效" }, { status: 400 });
    }

    const supabase = await createClient();

    // 验证用户身份
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userProfile.user_id) {
      return NextResponse.json({ error: "未授权访问" }, { status: 401 });
    }

    if (action === "vectorize") {
      // 向量化用户档案
      try {
        const documents = await profileToVectorDocuments(userProfile);
        await storeVectorDocuments(documents, userProfile.user_id);

        return NextResponse.json({
          success: true,
          message: "用户档案向量化成功",
          documentCount: documents.length,
        });
      } catch (error) {
        console.error("向量化失败:", error);
        return NextResponse.json({ error: "向量化失败" }, { status: 500 });
      }
    } else if (action === "generate_prompt") {
      // 生成个性化面试提示词
      try {
        const personalizedContext = extractPersonalizedContext(userProfile);
        const interviewPrompt =
          generatePersonalizedInterviewPrompt(personalizedContext);

        return NextResponse.json({
          success: true,
          prompt: interviewPrompt,
          context: personalizedContext,
        });
      } catch (error) {
        console.error("生成提示词失败:", error);
        return NextResponse.json({ error: "生成提示词失败" }, { status: 500 });
      }
    } else if (action === "rag_analysis") {
      // 执行RAG分析
      try {
        const { query } = await request.json();
        if (!query) {
          return NextResponse.json(
            { error: "查询内容不能为空" },
            { status: 400 },
          );
        }

        const analysis = await executeRAGPipeline(userProfile, query);

        return NextResponse.json({
          success: true,
          analysis,
        });
      } catch (error) {
        console.error("RAG分析失败:", error);
        return NextResponse.json({ error: "RAG分析失败" }, { status: 500 });
      }
    } else if (action === "check_stats") {
      // 检查向量统计信息
      try {
        const stats = await userProfileService.getUserProfileVectorStats(
          userProfile.user_id,
        );

        if (stats.success) {
          return NextResponse.json({
            success: true,
            stats: stats.stats,
          });
        } else {
          return NextResponse.json(
            { error: stats.error || "获取统计信息失败" },
            { status: 500 },
          );
        }
      } catch (error) {
        console.error("获取统计信息失败:", error);
        return NextResponse.json(
          { error: "获取统计信息失败" },
          { status: 500 },
        );
      }
    } else {
      return NextResponse.json({ error: "无效的操作类型" }, { status: 400 });
    }
  } catch (error) {
    console.error("Profile vectorize API error:", error);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

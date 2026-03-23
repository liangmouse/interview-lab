import { NextRequest, NextResponse } from "next/server";
import {
  createLangChainChatModelForUseCase,
  type AiUserTier,
  validateLlmConfig,
} from "@interviewclaw/ai-runtime";
import { convertToCoreMessages } from "@/lib/chat-utils";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { streamChatModelResponse, toLangChainMessages } from "./chat-llm";
import { createClient } from "@/lib/supabase/server";
import { resolveUserAccessForUserId } from "@/lib/billing/access";
import {
  extractPersonalizedContext,
  generatePersonalizedInterviewPrompt,
  generateSimpleInterviewPrompt,
} from "@/lib/profile-rag";
import {
  retrieveRelevantDocuments,
  generateIntelligentAnalysisPrompt,
} from "@/lib/vector-rag";
import {
  CONVERSATION_HISTORY_GUIDANCE,
  FALLBACK_PROMPT,
  SINGLE_QUESTION_GUIDANCE,
  SINGLE_QUESTION_CONSTRAINT,
} from "@/lib/prompt";
import {
  sanitizeMessageContent,
  sanitizeRAGQuery,
  detectInjectionAttempt,
} from "@/lib/security/prompt-injection";

function toAiUserTier(
  tier?: "free" | "premium" | null,
): AiUserTier | undefined {
  if (tier === "free") return "free";
  if (tier === "premium") return "premium";
  return undefined;
}
/**
 * 处理聊天消息的 POST 请求
 *
 * 调用路径：
 * - 前端：useChat hook -> /api/chat
 * - 组件：ChatInterface -> useInterviewLogic -> useChat -> /api/chat
 *
 * 请求格式：AI SDK 5.0 格式
 * {
 *   "messages": [...],
 *   "trigger": "submit-message"
 * }
 *
 * 响应格式：流式文本响应
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { messages, model, userId, enablePersonalization = true } = body;

    if (!messages || !Array.isArray(messages)) {
      console.error(`Invalid messages array:`, messages);
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 },
      );
    }

    // 2. 验证 LLM 配置
    const configValidation = validateLlmConfig();
    if (!configValidation.isValid) {
      console.error(
        `LLM provider config validation failed:`,
        configValidation.error,
      );
      return NextResponse.json(
        { error: configValidation.error || "LLM provider not configured" },
        { status: 500 },
      );
    }

    // 3. 获取用户档案并生成个性化提示词
    let systemPrompt = "";
    if (enablePersonalization && userId) {
      try {
        const supabase = await createClient();

        // 获取用户档案
        const { data: userProfile, error: profileError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (!profileError && userProfile) {
          // 检测面试初始化信号 - 修复检测逻辑
          const isInitSignal = messages.some(
            (msg) =>
              msg.role === "system" &&
              (msg.content === "INIT_INTERVIEW" ||
                (msg.parts &&
                  msg.parts.some(
                    (part: any) => part.text === "INIT_INTERVIEW",
                  ))),
          );

          if (messages.length === 0 || isInitSignal) {
            // 面试初始化阶段：使用简洁的个性化提示词
            const personalizedContext = extractPersonalizedContext(userProfile);
            systemPrompt = generateSimpleInterviewPrompt(personalizedContext);
          } else {
            // 正常对话阶段：使用个性化面试提示词
            const personalizedContext = extractPersonalizedContext(userProfile);
            systemPrompt =
              generatePersonalizedInterviewPrompt(personalizedContext);

            // 添加强化的单问题约束
            systemPrompt += "\n\n" + SINGLE_QUESTION_CONSTRAINT;

            // 添加单问题约束指导
            systemPrompt += "\n\n" + SINGLE_QUESTION_GUIDANCE;

            // 添加对话历史管理指导
            systemPrompt += "\n\n" + CONVERSATION_HISTORY_GUIDANCE;

            // 使用 RAG 进行深度分析（可选）
            try {
              // 提取最近的消息内容作为查询
              const recentMessages = messages.slice(-3); // 取最近3条消息
              const queryText = recentMessages
                .map((msg) => {
                  if (msg.role === "user") {
                    return (
                      msg.parts?.map((part: any) => part.text || "").join("") ||
                      ""
                    );
                  }
                  return "";
                })
                .join(" ");

              // 清理 RAG 查询文本，防止注入
              let sanitizedQueryText = sanitizeRAGQuery(queryText);

              if (sanitizedQueryText.trim()) {
                // 检索相关文档
                const relevantDocs = await retrieveRelevantDocuments(
                  queryText,
                  userId,
                );

                if (relevantDocs.length > 0) {
                  // 生成智能分析提示词
                  const ragContext = {
                    relevantDocuments: relevantDocs,
                    userProfile: userProfile,
                    analysisPrompt: "",
                  };
                  const ragAnalysis =
                    generateIntelligentAnalysisPrompt(ragContext);
                  systemPrompt += "\n\n" + ragAnalysis;
                }
              }
            } catch (ragError) {
              console.warn("RAG 分析失败:", ragError);
              // RAG 失败不影响主要功能
            }
          }
        }
      } catch (error) {
        console.error("获取用户档案失败:", error);
        // 如果获取用户档案失败，使用默认提示词
        systemPrompt = FALLBACK_PROMPT;
      }
    } else {
      systemPrompt = FALLBACK_PROMPT;
    }

    // 4. 构建消息数组，添加系统提示词
    // 过滤掉INIT_INTERVIEW初始化信号，避免发送给AI
    // 同时清理用户消息内容，防止提示词注入
    const filteredMessages = messages
      .filter(
        (msg) => !(msg.role === "system" && msg.content === "INIT_INTERVIEW"),
      )
      .map((msg) => {
        // 清理用户消息内容
        if (msg.role === "user") {
          // 处理 UIMessage 格式（有 parts）
          if (msg.parts && Array.isArray(msg.parts)) {
            const cleanedParts = msg.parts.map((part: any) => {
              if (part.type === "text" && part.text) {
                // 检测注入尝试
                const detection = detectInjectionAttempt(part.text);
                if (detection.isInjection && detection.severity === "high") {
                  console.warn("[安全] 检测到高严重程度注入尝试，已清理");
                }
                return {
                  ...part,
                  text: sanitizeMessageContent(part.text),
                };
              }
              return part;
            });
            return { ...msg, parts: cleanedParts };
          }
          // 处理传统格式（有 content）
          if (msg.content) {
            const detection = detectInjectionAttempt(msg.content);
            if (detection.isInjection && detection.severity === "high") {
              console.warn("[安全] 检测到高严重程度注入尝试，已清理");
            }
            return {
              ...msg,
              content: sanitizeMessageContent(msg.content),
            };
          }
        }
        return msg;
      });

    const messagesWithSystem = [
      { role: "system", content: systemPrompt },
      ...filteredMessages,
    ];

    // 5. 转换 UIMessage 格式为 Core Messages 格式
    const coreMessages = convertToCoreMessages(messagesWithSystem);

    let userTier: AiUserTier | undefined;
    if (userId) {
      try {
        const access = await resolveUserAccessForUserId(userId);
        userTier = toAiUserTier(access.tier);
      } catch (accessError) {
        console.warn("解析用户模型层级失败，回退默认策略:", accessError);
      }
    }

    // 6. 通过统一工厂初始化 LLM
    const llm = createLangChainChatModelForUseCase({
      useCase: "interview-core",
      ...(userTier ? { userTier } : {}),
      ...(model ? { model } : {}),
      temperature: 0.7,
      maxTokens: 4000,
      tracing: {
        ...(userId ? { userId } : {}),
        traceName: "web-chat-api",
        tags: ["web", "chat-api"],
        metadata: {
          feature: "chat-api",
          enablePersonalization,
          selectedModel: model ?? "default",
        },
      },
    });

    const lcMessages = toLangChainMessages(coreMessages);

    const uiStream = createUIMessageStream({
      execute: async ({ writer }) => {
        await streamChatModelResponse({
          llm,
          messages: lcMessages,
          writer,
        });
      },
      onError: (error) =>
        error instanceof Error ? error.message : "LLM provider response error",
    });

    // 7. 返回流式响应，兼容 useChat 的 UI Message 协议
    const response = createUIMessageStreamResponse({
      stream: uiStream,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(` Chat API error:`, {
      error: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
    });

    // 根据错误类型返回不同的状态码
    let statusCode = 500;
    let errorResponse = "Internal server error";

    if (errorMessage.includes("API key")) {
      statusCode = 500;
      errorResponse = "API key not configured";
    } else if (
      errorMessage.includes("rate limit") ||
      errorMessage.includes("quota")
    ) {
      statusCode = 429;
      errorResponse = "Rate limit exceeded";
    } else if (
      errorMessage.includes("invalid") ||
      errorMessage.includes("bad request")
    ) {
      statusCode = 400;
      errorResponse = "Invalid request";
    } else if (errorMessage.includes("timeout")) {
      statusCode = 504;
      errorResponse = "Request timeout";
    }

    return NextResponse.json(
      {
        error: errorResponse,
        details:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode },
    );
  }
}

// 处理 OPTIONS 请求（CORS 预检）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

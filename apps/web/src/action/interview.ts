"use server";

import { createClient } from "@/lib/supabase/server";
import { mergeMessagesToConversation } from "@/lib/chat-utils";

// 消息类型定义
export interface ChatMessage {
  id: string;
  content: string;
  timestamp: string;
}

export interface InterviewWithMessages {
  id: string;
  user_id: string;
  status: string;
  user_messages: ChatMessage[];
  ai_messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

/**
 * 添加用户消息到面试会话
 */
export async function addUserMessage(
  interviewId: string,
  content: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.rpc("add_user_message", {
      p_interview_id: interviewId,
      p_content: content,
    });

    if (error) {
      console.error("添加用户消息失败:", error);
      return { success: false, error: error.message };
    }

    console.log("成功添加用户消息:", content.substring(0, 50) + "...");
    return { success: true };
  } catch (error) {
    console.error("添加用户消息失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * @description: 添加AI消息到数据库
 */
export async function addAiMessage(
  interviewId: string,
  content: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.rpc("add_ai_message", {
      p_interview_id: interviewId,
      p_content: content,
    });

    if (error) {
      console.error("添加AI消息失败:", error);
      return { success: false, error: error.message };
    }

    console.log("成功添加AI消息:", content.substring(0, 50) + "...");
    return { success: true };
  } catch (error) {
    console.error("添加AI消息失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 获取面试会话的所有消息
 */
export async function getInterviewMessages(interviewId: string): Promise<{
  success: boolean;
  messages?: { user_messages: ChatMessage[]; ai_messages: ChatMessage[] };
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("get_interview_messages", {
      p_interview_id: interviewId,
    });

    if (error) {
      console.error("获取面试消息失败:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messages: data };
  } catch (error) {
    console.error("获取面试消息失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 获取完整的面试会话信息（包含消息）
 */
export async function getInterviewWithMessages(interviewId: string): Promise<{
  success: boolean;
  interview?: InterviewWithMessages;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("interviews")
      .select(
        "id, user_id, status, user_messages, ai_messages, created_at, updated_at",
      )
      .eq("id", interviewId)
      .single();

    if (error) {
      console.error("获取面试会话失败:", error);
      return { success: false, error: error.message };
    }

    return { success: true, interview: data as InterviewWithMessages };
  } catch (error) {
    console.error("获取面试会话失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 处理面试语音交互的核心函数（兼容旧 API）
 */
export async function processInterviewSpeech({
  transcript,
  interviewId,
}: {
  transcript: string;
  interviewId: string;
}) {
  try {
    // 保存用户消息
    await addUserMessage(interviewId, transcript);

    // TODO: 这里应该调用实际的 AI 处理逻辑
    // 目前只是保存用户消息，AI 响应会通过其他渠道处理
    return {
      success: true,
      response: "消息已保存，等待 AI 响应...",
    };
  } catch (error) {
    console.error("处理面试语音失败:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "未知错误",
    };
  }
}

/**
 * 获取面试历史记录（兼容旧 API）
 */
export async function getInterviewHistory(interviewId: string) {
  try {
    const result = await getInterviewWithMessages(interviewId);

    if (!result.success || !result.interview) {
      return {
        success: false,
        messages: [],
      };
    }

    const { user_messages, ai_messages } = result.interview;
    const conversation = mergeMessagesToConversation(
      user_messages,
      ai_messages,
    );

    return {
      success: true,
      messages: conversation.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
      })),
    };
  } catch (error) {
    console.error("获取面试历史失败:", error);
    return {
      success: false,
      messages: [],
    };
  }
}

// 聊天相关的工具函数
import type { UIMessage } from "@ai-sdk/react";
import type { CoreMessage } from "ai";
import { sanitizeMessageContent } from "@/lib/security/prompt-injection";

// 聊天消息接口 - 与 src/types/interview.ts 中的 Message 保持一致
export interface ChatMessage {
  id: string;
  content: string;
  timestamp: string;
}

// 导入公共类型
import type { MessageRole } from "@/types/message";

/**
 * 将 UIMessage 格式转换为 Core Messages 格式（用于 @ai-sdk/google）
 * 支持多模态内容：文本、图片、工具调用等
 */
export function convertToCoreMessages(uiMessages: UIMessage[]): CoreMessage[] {
  return uiMessages
    .map((message) => {
      // 如果是 UIMessage 格式（有 parts 属性）
      if (message.parts && Array.isArray(message.parts)) {
        let textContent = "";
        const toolInvocations: any[] = [];
        const imageParts: any[] = [];

        // 遍历所有 parts，根据类型分类处理
        for (const part of message.parts) {
          const partType = part.type;

          if (partType === "text") {
            // 文本内容：拼接到 textContent
            textContent += (part as any).text || "";
          } else if (partType.startsWith("tool-")) {
            // 工具调用：type 格式为 "tool-{toolName}"
            toolInvocations.push({
              toolCallId: (part as any).toolCallId,
              toolName: (part as any).toolName || partType.substring(5), // 从 "tool-" 后提取工具名
              args: (part as any).args,
              state: "result",
            });
            // TODO 这里待测试，短期应该用不到图片
          } else if (partType === "file" || partType === "source-url") {
            // 文件/图片：可以是本地文件或外部 URL
            imageParts.push({
              type: partType,
              url: (part as any).url || (part as any).data,
              mimeType: (part as any).mimeType,
            });
          }
        }

        // 清理用户消息内容（防止注入）
        const cleanedContent =
          message.role === "user"
            ? sanitizeMessageContent(textContent)
            : textContent;

        // 构建 CoreMessage，根据是否有工具调用决定结构
        const coreMessage: any = {
          role: message.role,
          content: cleanedContent,
        };

        // 如果有工具调用，添加到消息中
        if (toolInvocations.length > 0) {
          coreMessage.toolInvocations = toolInvocations;
        }

        // 如果有图片且内容为空，可以用图片数组代替 content
        if (imageParts.length > 0 && !cleanedContent.trim()) {
          coreMessage.content = imageParts;
        }

        return coreMessage;
      }

      // 如果已经是传统格式（有 content 属性）
      const rawContent = (message as any).content || "";
      const cleanedContent =
        message.role === "user"
          ? sanitizeMessageContent(rawContent)
          : rawContent;

      return {
        role: message.role,
        content: cleanedContent,
      };
    })
    .filter((message) => {
      // 过滤掉空消息（但保留有工具调用的消息）
      const hasContent =
        typeof message.content === "string"
          ? message.content.trim() !== ""
          : Array.isArray(message.content) && message.content.length > 0;
      const hasTools = (message as any).toolInvocations?.length > 0;
      return hasContent || hasTools;
    });
}

/**
 * 合并用户消息和AI消息为对话格式（用于前端显示）
 */
export function mergeMessagesToConversation(
  userMessages: ChatMessage[],
  aiMessages: ChatMessage[],
): Array<{
  role: MessageRole;
  content: string;
  id: string;
  timestamp: string;
}> {
  const conversation: Array<{
    role: MessageRole;
    content: string;
    id: string;
    timestamp: string;
  }> = [];

  // 添加用户消息
  userMessages.forEach((msg) => {
    conversation.push({
      role: "user",
      content: msg.content,
      id: msg.id,
      timestamp: msg.timestamp,
    });
  });

  // 添加AI消息
  aiMessages.forEach((msg) => {
    conversation.push({
      role: "assistant",
      content: msg.content,
      id: msg.id,
      timestamp: msg.timestamp,
    });
  });

  // 按时间戳排序
  return conversation.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

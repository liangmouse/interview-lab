"use client";

import { useChat as useAIChat } from "@ai-sdk/react";
import { useEffect } from "react";
import type { UIMessage } from "@ai-sdk/react";

interface UsePersonalizedChatOptions {
  id: string;
  messages: UIMessage[];
  userId?: string;
  enablePersonalization?: boolean;
  onFinish?: (options: any) => void;
  onError?: (error: Error) => void;
}

export function usePersonalizedChat({
  id,
  messages,
  userId,
  enablePersonalization = true,
  onFinish,
  onError,
}: UsePersonalizedChatOptions) {
  const chat = useAIChat({
    id,
    messages,
    onFinish: (options) => {
      // 为新消息添加时间戳
      if (options.message && !(options.message as any).timestamp) {
        (options.message as any).timestamp = new Date().toISOString();
      }
      onFinish?.(options);
    },
    onError,
  });

  // 当历史消息变化时，直接设置到 useChat
  useEffect(() => {
    if (messages && messages.length > 0) {
      chat.setMessages(messages);
    }
  }, [messages, chat.setMessages]);

  // 重写 sendMessage 方法，自动添加 body 参数
  const originalSendMessage = chat.sendMessage;
  chat.sendMessage = (message, options = {}) => {
    return originalSendMessage(message, {
      ...options,
      body: {
        ...options.body,
        userId,
        enablePersonalization,
      },
    });
  };

  return chat;
}

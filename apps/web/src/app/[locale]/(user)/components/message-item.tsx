"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import type { UIMessage } from "@ai-sdk/react";
// 扩展 UIMessage 类型以包含时间戳
interface ExtendedUIMessage extends UIMessage {
  timestamp?: string;
}

interface MessageItemProps {
  message: ExtendedUIMessage;
  index: number;
}

export const MessageItem = memo(({ message }: MessageItemProps) => {
  return (
    <motion.div
      key={message.id}
      layout="position"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.3,
        delay: 0, // 移除基于index的延迟，避免重新渲染时的抖动
        ease: "easeOut",
      }}
      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[70%] p-4 rounded-3xl overflow-hidden ${
          message.role === "user"
            ? "bg-[rgba(233,233,233,0.5)] text-gray-900"
            : "bg-white/80 text-gray-800 border border-white/50"
        }`}
      >
        <motion.div
          whileHover={{ scale: 1.01 }} // 减小缩放幅度，避免布局投影重计算
          transition={{ duration: 0.2 }}
          className="flex items-start space-x-2"
        >
          {message.role === "assistant" && (
            <motion.span
              className="text-lg inline-flex items-center justify-center w-5 flex-none leading-none"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              🤖
            </motion.span>
          )}
          {/* 如果有多处类似场景下多处使用ReactMD组件，考虑抽出 */}
          <div
            className={`prose prose-sm max-w-none ${
              message.role === "user"
                ? "prose-invert prose-headings:text-white prose-strong:text-white prose-em:text-white/90 prose-code:text-white prose-pre:bg-white/20 prose-blockquote:border-white/30 prose-blockquote:text-white/90"
                : "prose-gray prose-headings:text-gray-900 prose-strong:text-gray-900 prose-em:text-gray-700 prose-code:text-gray-800 prose-pre:bg-gray-50 prose-blockquote:border-gray-300 prose-blockquote:text-gray-600"
            }`}
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className={`mb-2 last:mb-0 text-sm leading-relaxed`}>
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong
                    className={`font-semibold ${
                      message.role === "user" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em
                    className={`italic ${
                      message.role === "user"
                        ? "text-white/90"
                        : "text-gray-700"
                    }`}
                  >
                    {children}
                  </em>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 my-2 ml-2">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-1 my-2 ml-2">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li
                    className={`text-sm leading-relaxed ${
                      message.role === "user" ? "text-white" : ""
                    }`}
                  >
                    {children}
                  </li>
                ),
                h1: ({ children }) => (
                  <h1
                    className={`text-lg font-bold mb-2 mt-3 first:mt-0 ${
                      message.role === "user" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2
                    className={`text-base font-bold mb-2 mt-3 first:mt-0 ${
                      message.role === "user" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3
                    className={`text-sm font-bold mb-1 mt-2 first:mt-0 ${
                      message.role === "user" ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {children}
                  </h3>
                ),
                blockquote: ({ children }) => (
                  <blockquote
                    className={`border-l-4 pl-4 my-2 italic py-2 rounded-r ${
                      message.role === "user"
                        ? "border-white/30 text-white/90 bg-white/10"
                        : "border-gray-300 text-gray-600 bg-gray-50/50"
                    }`}
                  >
                    {children}
                  </blockquote>
                ),
                code: ({ children, className }) => {
                  const isInline = !className;
                  if (isInline) {
                    return (
                      <code
                        className={`px-1.5 py-0.5 rounded text-xs font-mono ${
                          message.role === "user"
                            ? "bg-white/20 text-white"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code
                      className={`block p-3 rounded text-xs font-mono overflow-x-auto my-2 ${
                        message.role === "user"
                          ? "bg-white/20 text-white"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre
                    className={`p-3 rounded overflow-x-auto my-2 text-xs ${
                      message.role === "user"
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {children}
                  </pre>
                ),
              }}
            >
              {message.parts
                ?.filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("") || ""}
            </ReactMarkdown>
          </div>
        </motion.div>
        <p
          className={`text-xs mt-2 ${
            message.role === "user" ? "text-gray-500" : "text-gray-500"
          }`}
        >
          {message.timestamp
            ? format(new Date(message.timestamp), "HH:mm")
            : format(new Date(), "HH:mm")}
        </p>
      </div>
    </motion.div>
  );
});

MessageItem.displayName = "MessageItem";

import type { CoreMessage } from "ai";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  type BaseMessage,
} from "@langchain/core/messages";

type StreamWriter = {
  write: (chunk: any) => void;
};

type StreamChunk = {
  content?: unknown;
};

type StreamableChatModel = {
  stream: (
    messages: BaseMessage[],
  ) => Promise<AsyncIterable<StreamChunk>> | AsyncIterable<StreamChunk>;
};

function serializeMessageContent(content: CoreMessage["content"]) {
  if (typeof content === "string") return content;
  return JSON.stringify(content);
}

function extractChunkText(content: unknown): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          typeof part === "object" &&
          part !== null &&
          "text" in part &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
        return "";
      })
      .join("");
  }

  return "";
}

export function toLangChainMessages(
  coreMessages: CoreMessage[],
): BaseMessage[] {
  return coreMessages.map((message) => {
    const content = serializeMessageContent(message.content);

    switch (message.role) {
      case "system":
        return new SystemMessage(content);
      case "assistant":
        return new AIMessage(content);
      case "user":
        return new HumanMessage(content);
      default:
        return new HumanMessage(`[${message.role}] ${content}`);
    }
  });
}

export async function streamChatModelResponse(args: {
  llm: StreamableChatModel;
  messages: BaseMessage[];
  writer: StreamWriter;
  textId?: string;
}) {
  const { llm, messages, writer, textId = "text-0" } = args;

  writer.write({ type: "start" });
  writer.write({ type: "start-step" });
  writer.write({ type: "text-start", id: textId });

  const stream = await llm.stream(messages);
  for await (const chunk of stream) {
    const delta = extractChunkText(chunk?.content);
    if (!delta) continue;
    writer.write({ type: "text-delta", id: textId, delta });
  }

  writer.write({ type: "text-end", id: textId });
  writer.write({ type: "finish-step" });
  writer.write({ type: "finish" });
}

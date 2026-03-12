import { describe, expect, it, vi } from "vitest";
import type { CoreMessage } from "ai";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { streamChatModelResponse, toLangChainMessages } from "./chat-llm";

describe("chat-llm", () => {
  it("keeps role semantics when converting core messages", () => {
    const coreMessages: CoreMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ];

    const messages = toLangChainMessages(coreMessages);

    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect(messages[1]).toBeInstanceOf(HumanMessage);
    expect(messages[2]).toBeInstanceOf(AIMessage);
  });

  it("streams response in multiple deltas instead of single buffered write", async () => {
    const writes: any[] = [];
    const writer = {
      write: vi.fn((chunk: any) => writes.push(chunk)),
    };

    async function* streamGen() {
      yield { content: "hello " };
      yield { content: "world" };
    }

    const llm = {
      stream: vi.fn(async () => streamGen()),
    };

    await streamChatModelResponse({
      llm,
      messages: [new HumanMessage("test")],
      writer,
    });

    const deltas = writes.filter((item) => item.type === "text-delta");
    expect(llm.stream).toHaveBeenCalledTimes(1);
    expect(deltas).toHaveLength(2);
    expect(deltas.map((item) => item.delta).join("")).toBe("hello world");
  });
});

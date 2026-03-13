import { beforeEach, describe, expect, it, vi } from "vitest";

const createConfiguredLLM = vi.fn(() => ({
  chat: vi.fn(async () => {
    async function* chunks() {
      yield {
        choices: [
          {
            delta: {
              content: "summary",
            },
          },
        ],
      };
    }

    return chunks();
  }),
}));

vi.mock("../../config/providers", () => {
  return {
    createConfiguredLLM,
  };
});

vi.mock("@livekit/agents", () => {
  class ChatContext {
    public messages: unknown[] = [];

    addMessage(message: unknown) {
      this.messages.push(message);
    }
  }

  return {
    llm: {
      ChatContext,
    },
  };
});

describe("runtime/fsm/summarizer", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("builds its LLM from createConfiguredLLM", async () => {
    const { summarizeStage } = await import("./summarizer");

    const summary = await summarizeStage(
      "introduction" as never,
      [{ role: "user", content: "hello" }] as never,
      "user-1",
    );

    expect(createConfiguredLLM).toHaveBeenCalledWith("user-1");
    expect(summary).toBe("summary");
  });
});

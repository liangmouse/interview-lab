import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the context loader so we don't pull in supabase or heavy deps
vi.mock("../services/context-loader", () => {
  return {
    buildSystemPrompt: vi.fn(() => "PROMPT_FROM_BUILD"),
    loadInterviewMessages: vi.fn(async () => []),
  };
});

// Mock @livekit/agents voice.Agent so we can control the handoff-wait loop
vi.mock("@livekit/agents", () => {
  class Agent {
    public _ready = false;
    public _instructions: string;
    constructor(opts: { instructions: string }) {
      this._instructions = opts.instructions;
    }
    get session() {
      if (!this._ready) {
        throw new Error("Agent activity not found");
      }
      return {};
    }
  }

  class ChatContext {
    public messages: any[] = [];
    addMessage(msg: any) {
      this.messages.push(msg);
    }
  }

  class TTS {
    constructor() {}
  }

  class ChunkedStream {
    constructor() {}
  }

  return {
    voice: { Agent },
    llm: {
      ChatContext,
      tool: vi.fn((opts) => opts),
    },
    tts: { TTS, ChunkedStream },
  };
});

// Mock summarizer to avoid side-effects from providers.ts (missing env vars)
vi.mock("./fsm/summarizer", () => {
  return {
    summarizeStage: vi.fn(async () => "MOCKED_SUMMARY"),
  };
});

// Mock prompt builder to valid the check in updates agent test
vi.mock("./fsm/prompt-builder", () => {
  return {
    buildStagePrompt: vi.fn(() => "PROMPT_FROM_BUILD"),
  };
});

// Mock orchestrator so runtime tests stay isolated from Supabase-backed planning
vi.mock("./interview-orchestrator", () => {
  class InterviewOrchestrator {
    async ensureReady() {
      return { questions: [] };
    }

    async getPromptContext() {
      return "MOCKED_PLANNING_CONTEXT";
    }
  }

  return {
    InterviewOrchestrator,
  };
});

import { createInterviewApplier } from "./interview";
import * as contextLoader from "../services/context-loader";

describe("runtime/interview.createInterviewApplier", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("updates agent and generates a natural kickoff that includes candidate name", async () => {
    vi.useFakeTimers();
    const session = {
      updateAgent: vi.fn((agent: any) => {
        agent._ready = true;
      }),
      generateReply: vi.fn(async () => {}),
    };

    const apply = createInterviewApplier({
      session: session as any,
      userId: "user-1",
      userProfile: { nickname: "梁爽" },
    });

    await apply({ type: "frontend:beginner", duration: 10 });
    await vi.advanceTimersByTimeAsync(1000);

    expect(session.updateAgent).toHaveBeenCalledTimes(1);
    const agentInstance = (session.updateAgent.mock.calls[0] as any)[0];
    expect(agentInstance._instructions).toBe("PROMPT_FROM_BUILD");

    expect(session.generateReply).toHaveBeenCalledTimes(1);
    const arg = (session.generateReply.mock.calls[0] as any)[0];
    expect(arg.userInput).toBe("系统：面试开场");
    expect(String(arg.instructions)).toContain(
      "只输出这句固定开场白，不要添加或修改任何内容：您好梁爽,我是今天的面试官,如果你已经准备好,就请做个简单的自我介绍吧",
    );
  });

  it("queues concurrent apply calls and runs them sequentially", async () => {
    vi.useFakeTimers();
    const events: string[] = [];

    const session = {
      updateAgent: vi.fn((agent: any) => {
        events.push("update");
        agent._ready = true;
      }),
      generateReply: vi.fn(async () => {
        events.push("reply");
        await new Promise((r) => setTimeout(r, 10));
      }),
    };

    const apply = createInterviewApplier({
      session: session as any,
      userId: "user-1",
      userProfile: { nickname: "梁爽" },
    });

    const p1 = apply({ type: "frontend:beginner" });
    const p2 = apply({ type: "frontend:intermediate" });

    // Advance time just enough to trigger the internal timeouts (500ms)
    // but NOT enough to trigger stage transitions (which default to 30 mins)
    await vi.advanceTimersByTimeAsync(2000);
    await Promise.all([p1, p2]);

    expect(session.updateAgent).toHaveBeenCalledTimes(2);
    expect(session.generateReply).toHaveBeenCalledTimes(2);
    expect(events.filter((e) => e === "update").length).toBe(2);
    expect(events.filter((e) => e === "reply").length).toBe(2);
  });

  it("still sends kickoff when history only contains system messages", async () => {
    vi.useFakeTimers();
    vi.mocked(contextLoader.loadInterviewMessages).mockResolvedValue([
      {
        role: "system",
        content: "internal setup",
        created_at: "2026-02-25T00:00:00.000Z",
      },
    ] as any);

    const session = {
      updateAgent: vi.fn((agent: any) => {
        agent._ready = true;
      }),
      generateReply: vi.fn(async () => {}),
    };

    const apply = createInterviewApplier({
      session: session as any,
      userId: "user-1",
      userProfile: { nickname: "梁爽" },
    });

    await apply({
      id: "interview-id",
      type: "frontend:beginner",
      duration: 10,
    });
    await vi.advanceTimersByTimeAsync(1000);

    expect(session.generateReply).toHaveBeenCalledTimes(1);
  });
});

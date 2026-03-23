import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateClient,
  mockRpc,
  mockFrom,
  mockSelect,
  mockEq,
  mockSingle,
  mockInvoke,
  mockCreateLangChainChatModelForUseCase,
} = vi.hoisted(() => {
  const mockRpc = vi.fn();
  const mockSingle = vi.fn();
  const mockEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ select: mockSelect }));
  const mockCreateClient = vi.fn(async () => ({
    rpc: mockRpc,
    from: mockFrom,
  }));
  const mockInvoke = vi.fn();
  const mockCreateLangChainChatModelForUseCase = vi.fn(() => ({
    invoke: mockInvoke,
  }));

  return {
    mockCreateClient,
    mockRpc,
    mockFrom,
    mockSelect,
    mockEq,
    mockSingle,
    mockInvoke,
    mockCreateLangChainChatModelForUseCase,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@interviewclaw/ai-runtime", () => ({
  validateLlmConfig: vi.fn(() => ({ isValid: true })),
  createLangChainChatModel: vi.fn(function MockCreateLangChainChatModel() {
    return { invoke: mockInvoke };
  }),
  createLangChainChatModelForUseCase: mockCreateLangChainChatModelForUseCase,
}));

import { processInterviewSpeech } from "./interview";

describe("processInterviewSpeech", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-api-key-12345";
    process.env.GEMINI_MODEL = "gemini-test-model";

    mockCreateClient.mockResolvedValue({
      rpc: mockRpc,
      from: mockFrom,
    });
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });

    mockRpc.mockImplementation((name: string) => {
      if (name === "add_user_message" || name === "add_ai_message") {
        return Promise.resolve({ error: null });
      }
      if (name === "get_interview_messages") {
        return Promise.resolve({
          data: {
            user_messages: [],
            ai_messages: [],
          },
          error: null,
        });
      }

      return Promise.resolve({ error: null });
    });

    mockSingle.mockResolvedValue({
      data: {
        id: "interview-1",
        user_id: "user-1",
        status: "active",
        user_messages: [
          {
            id: "user-msg-1",
            content: "我做过一个高并发秒杀项目。",
            timestamp: "2026-03-09T10:00:00.000Z",
          },
        ],
        ai_messages: [
          {
            id: "ai-msg-1",
            content: "你先简要介绍一下项目背景。",
            timestamp: "2026-03-09T09:59:00.000Z",
          },
        ],
        created_at: "2026-03-09T09:50:00.000Z",
        updated_at: "2026-03-09T10:00:00.000Z",
      },
      error: null,
    });
  });

  it("generates and persists an AI reply after saving the user transcript", async () => {
    mockInvoke.mockResolvedValue({
      content:
        "你刚才提到高并发秒杀项目，能具体讲一下你是如何做库存一致性控制的吗？",
    });

    const result = await processInterviewSpeech({
      interviewId: "interview-1",
      transcript: "我做过一个高并发秒杀项目。",
    });

    expect(result).toEqual({
      success: true,
      response:
        "你刚才提到高并发秒杀项目，能具体讲一下你是如何做库存一致性控制的吗？",
    });
    expect(mockRpc).toHaveBeenNthCalledWith(1, "add_user_message", {
      p_interview_id: "interview-1",
      p_content: "我做过一个高并发秒杀项目。",
    });
    expect(mockCreateLangChainChatModelForUseCase).toHaveBeenCalledWith({
      useCase: "interview-core",
      temperature: 0.7,
    });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenNthCalledWith(2, "add_ai_message", {
      p_interview_id: "interview-1",
      p_content:
        "你刚才提到高并发秒杀项目，能具体讲一下你是如何做库存一致性控制的吗？",
    });
  });

  it("returns an error and does not persist AI reply when model invocation fails", async () => {
    mockInvoke.mockRejectedValue(new Error("quota exceeded"));

    const result = await processInterviewSpeech({
      interviewId: "interview-1",
      transcript: "我做过一个高并发秒杀项目。",
    });

    expect(result).toEqual({
      success: false,
      error: "quota exceeded",
    });
    expect(mockRpc).toHaveBeenCalledWith("add_user_message", {
      p_interview_id: "interview-1",
      p_content: "我做过一个高并发秒杀项目。",
    });
    expect(mockRpc).not.toHaveBeenCalledWith(
      "add_ai_message",
      expect.anything(),
    );
  });
});

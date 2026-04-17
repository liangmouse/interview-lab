import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockRequireOwnedInterview,
  mockLoadExistingInterviewPlan,
  mockGenerateDynamicInterviewOpening,
  mockLoadRecentConversationMessages,
  mockGetCurrentQuestion,
  mockAnalyzeInterviewAnswer,
  mockPersistDecisionArtifacts,
} = vi.hoisted(() => ({
  mockRequireOwnedInterview: vi.fn(),
  mockLoadExistingInterviewPlan: vi.fn(),
  mockGenerateDynamicInterviewOpening: vi.fn(),
  mockLoadRecentConversationMessages: vi.fn(),
  mockGetCurrentQuestion: vi.fn(),
  mockAnalyzeInterviewAnswer: vi.fn(),
  mockPersistDecisionArtifacts: vi.fn(),
}));

vi.mock("@/lib/interview-rag-service", () => ({
  requireOwnedInterview: mockRequireOwnedInterview,
  loadExistingInterviewPlan: mockLoadExistingInterviewPlan,
  generateDynamicInterviewOpening: mockGenerateDynamicInterviewOpening,
  loadRecentConversationMessages: mockLoadRecentConversationMessages,
  getCurrentQuestion: mockGetCurrentQuestion,
  analyzeInterviewAnswer: mockAnalyzeInterviewAnswer,
  persistDecisionArtifacts: mockPersistDecisionArtifacts,
}));

import { POST } from "./route";

describe("POST /api/interview/next-question", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOwnedInterview.mockResolvedValue({
      profile: { job_intention: "前端开发" },
    });
    mockLoadRecentConversationMessages.mockResolvedValue([]);
  });

  it("falls back to dynamic opening when no existing plan is available", async () => {
    mockLoadExistingInterviewPlan.mockResolvedValue(null);
    mockGenerateDynamicInterviewOpening.mockResolvedValue({
      question: {
        questionId: "dynamic-q-1",
        questionText: "先介绍一下你最近最有代表性的项目。",
      },
      index: 0,
      decision: {
        action: "switch_topic",
        reason: "动态开场",
        shouldAdvance: true,
        nextQuestionId: "dynamic-q-1",
        questionText: "先介绍一下你最近最有代表性的项目。",
      },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/interview/next-question", {
        method: "POST",
        body: JSON.stringify({ interviewId: "interview-1" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockGenerateDynamicInterviewOpening).toHaveBeenCalledWith({
      interviewId: "interview-1",
      profile: { job_intention: "前端开发" },
      recentMessages: [],
    });
    expect(data.question.questionId).toBe("dynamic-q-1");
    expect(data.decision.questionText).toContain("代表性的项目");
  });

  it("forces self-introduction opening before using an existing plan when no user message exists", async () => {
    mockLoadExistingInterviewPlan.mockResolvedValue({
      id: "plan-1",
      interviewId: "interview-1",
      questions: [
        {
          questionId: "q-1",
          questionText: "旧问题",
        },
      ],
    });
    mockGenerateDynamicInterviewOpening.mockResolvedValue({
      question: {
        questionId: "dynamic-intro-1",
        questionText:
          "你好，欢迎参加今天的前端开发面试。先请你做一个简短的自我介绍，重点说说最近做过的项目和你负责的部分。",
      },
      index: 0,
      decision: {
        action: "switch_topic",
        reason: "当前 interviewId 下用户尚未发言，先固定引导自我介绍。",
        shouldAdvance: true,
        nextQuestionId: "dynamic-intro-1",
        questionText:
          "你好，欢迎参加今天的前端开发面试。先请你做一个简短的自我介绍，重点说说最近做过的项目和你负责的部分。",
      },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/interview/next-question", {
        method: "POST",
        body: JSON.stringify({ interviewId: "interview-1" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockGenerateDynamicInterviewOpening).toHaveBeenCalledWith({
      interviewId: "interview-1",
      profile: { job_intention: "前端开发" },
      recentMessages: [],
    });
    expect(mockGetCurrentQuestion).not.toHaveBeenCalled();
    expect(data.decision.questionText).toContain("简短的自我介绍");
  });
});

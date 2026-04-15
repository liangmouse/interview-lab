import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockRequireOwnedInterview,
  mockLoadExistingInterviewPlan,
  mockGenerateDynamicInterviewEvaluation,
  mockAnalyzeInterviewAnswer,
  mockBuildTraceFromAnalysis,
  mockPersistDecisionArtifacts,
  mockCreateClient,
  mockFrom,
  mockInsert,
} = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockFrom = vi.fn(() => ({ insert: mockInsert }));
  const mockCreateClient = vi.fn(async () => ({ from: mockFrom }));

  return {
    mockRequireOwnedInterview: vi.fn(),
    mockLoadExistingInterviewPlan: vi.fn(),
    mockGenerateDynamicInterviewEvaluation: vi.fn(),
    mockAnalyzeInterviewAnswer: vi.fn(),
    mockBuildTraceFromAnalysis: vi.fn(),
    mockPersistDecisionArtifacts: vi.fn(),
    mockCreateClient,
    mockFrom,
    mockInsert,
  };
});

vi.mock("@/lib/interview-rag-service", () => ({
  requireOwnedInterview: mockRequireOwnedInterview,
  loadExistingInterviewPlan: mockLoadExistingInterviewPlan,
  generateDynamicInterviewEvaluation: mockGenerateDynamicInterviewEvaluation,
  analyzeInterviewAnswer: mockAnalyzeInterviewAnswer,
  buildTraceFromAnalysis: mockBuildTraceFromAnalysis,
  persistDecisionArtifacts: mockPersistDecisionArtifacts,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { POST } from "./route";

describe("POST /api/interview/evaluate-turn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireOwnedInterview.mockResolvedValue({
      profile: { job_intention: "前端开发" },
      interview: {},
    });
    mockLoadExistingInterviewPlan.mockResolvedValue(null);
    mockGenerateDynamicInterviewEvaluation.mockResolvedValue({
      currentQuestion: {
        questionId: "dynamic-q-1",
        questionText: "先介绍一下你最近最有代表性的项目。",
      },
      decision: {
        action: "drill_down",
        reason: "继续深挖",
        shouldAdvance: false,
        nextQuestionId: "dynamic-q-1",
        questionText: "你刚才提到性能优化，具体怎么做的？",
      },
      trace: {
        questionId: "dynamic-q-1",
        questionType: "project",
        expectedSignals: ["职责明确"],
        candidateAnswerSpan: ["我做了性能优化"],
        detectedSignals: ["提到了性能优化"],
        missingSignals: ["量化结果"],
        riskFlags: [],
        followUpReason: "继续深挖",
        scoreByDimension: {
          clarity: 72,
          depth: 68,
          evidence: 60,
          relevance: 78,
        },
        finalComment: "回答有基础，但还不够深入。",
        confidence: 0.74,
      },
      overallScore: 70,
      nextQuestion: {
        questionId: "dynamic-q-1",
        questionText: "你刚才提到性能优化，具体怎么做的？",
      },
    });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("evaluates dynamically when there is no saved plan", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/interview/evaluate-turn", {
        method: "POST",
        body: JSON.stringify({
          interviewId: "interview-1",
          questionId: "dynamic-q-1",
          questionText: "先介绍一下你最近最有代表性的项目。",
          answer: "我最近做了一个性能优化项目。",
        }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockGenerateDynamicInterviewEvaluation).toHaveBeenCalledWith({
      interviewId: "interview-1",
      profile: { job_intention: "前端开发" },
      questionId: "dynamic-q-1",
      questionText: "先介绍一下你最近最有代表性的项目。",
      answer: "我最近做了一个性能优化项目。",
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        question_asset_id: null,
        question_text: "先介绍一下你最近最有代表性的项目。",
      }),
    );
    expect(data.decision.questionText).toContain("具体怎么做的");
  });
});

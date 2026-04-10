import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  loadCodingInterviewSessionMock,
  upsertCodingInterviewSessionMock,
  requireOwnedInterviewMock,
  getOrGenerateCodingInterviewProblemsMock,
  parseInterviewTypeMock,
} = vi.hoisted(() => ({
  loadCodingInterviewSessionMock: vi.fn(),
  upsertCodingInterviewSessionMock: vi.fn(),
  requireOwnedInterviewMock: vi.fn(),
  getOrGenerateCodingInterviewProblemsMock: vi.fn(),
  parseInterviewTypeMock: vi.fn(),
}));

vi.mock("@interviewclaw/data-access", () => ({
  codingInterviewDataAccess: {
    loadCodingInterviewSession: loadCodingInterviewSessionMock,
    upsertCodingInterviewSession: upsertCodingInterviewSessionMock,
    saveCodingInterviewDraftState: vi.fn(),
  },
}));

vi.mock("@/lib/interview-rag-service", () => ({
  requireOwnedInterview: requireOwnedInterviewMock,
}));

vi.mock("@/lib/coding-interview-service", () => ({
  getOrGenerateCodingInterviewProblems:
    getOrGenerateCodingInterviewProblemsMock,
}));

vi.mock("@/lib/interview-session", () => ({
  parseInterviewType: parseInterviewTypeMock,
}));

import { POST } from "./route";

describe("Coding Problems API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    requireOwnedInterviewMock.mockResolvedValue({
      profile: { id: "profile-1" },
      interview: { id: "interview-1", type: "frontend:intermediate:coding" },
    });
    parseInterviewTypeMock.mockReturnValue({ variant: "coding" });
    getOrGenerateCodingInterviewProblemsMock.mockResolvedValue({
      source: "llm",
      problems: [
        {
          id: "problem-1",
          title: "两数之和",
          description: "描述",
          difficulty: "easy",
          language: "javascript",
          sourceKind: "leetcode",
          examples: [{ input: "1,2", output: "3" }],
          constraints: ["约束"],
          solutionTemplate: "function solve() {}",
          testTemplate: "describe('test', () => {})",
        },
      ],
    });
    upsertCodingInterviewSessionMock.mockResolvedValue(undefined);
  });

  it("redirects back to interview dashboard when persisted session loading fails", async () => {
    loadCodingInterviewSessionMock.mockRejectedValue(
      new Error(
        'Failed to load coding interview session: relation "public.coding_interview_sessions" does not exist',
      ),
    );

    const request = new NextRequest(
      "http://localhost:3000/api/interview/coding-problems",
      {
        method: "POST",
        body: JSON.stringify({ interviewId: "interview-1" }),
      },
    );

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.redirectTo).toBe("/interview");
    expect(getOrGenerateCodingInterviewProblemsMock).not.toHaveBeenCalled();
  });
});

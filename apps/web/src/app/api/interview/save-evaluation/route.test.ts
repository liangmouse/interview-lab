import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Hoist mocks
const {
  mockFrom,
  mockSupabase,
  mockSelect,
  mockSingle,
  mockInsert,
  mockAuth,
  mockCreateClient,
  mockEq,
} = vi.hoisted(() => {
  const mockEq = vi.fn();
  const mockSingle = vi.fn();
  const mockInsert = vi.fn();
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockAuth = { getUser: vi.fn() };

  // Setup Mock Returns
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert });

  const mockSupabase = {
    from: mockFrom,
    auth: mockAuth,
  };

  const mockCreateClient = vi.fn(() => Promise.resolve(mockSupabase));

  return {
    mockFrom,
    mockSupabase,
    mockSelect,
    mockSingle,
    mockInsert,
    mockAuth,
    mockCreateClient,
    mockEq,
  };
});

// Mock '@/lib/supabase/server'
vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { POST } from "./route";

describe("Save Evaluation API", () => {
  beforeEach(() => {
    vi.clearAllMocks(); // Clear call history

    // Reset default behaviors
    mockCreateClient.mockResolvedValue(mockSupabase);
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });

    // Ensure chain is always consistent
    mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });

    mockSingle.mockResolvedValue({
      data: { id: "interview-123", user_id: "user-123" },
      error: null,
    });
    mockInsert.mockResolvedValue({ error: null });
  });

  it("should return 400 if required fields are missing", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/interview/save-evaluation",
      {
        method: "POST",
        body: JSON.stringify({ interviewId: "123" }), // Missing others
      },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("缺少必要参数");
  });

  it("should return 401 if user is not logged in", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const req = new NextRequest(
      "http://localhost:3000/api/interview/save-evaluation",
      {
        method: "POST",
        body: JSON.stringify({
          interviewId: "123",
          questionId: "q1",
          questionText: "t",
          answerText: "a",
          overallScore: 5,
          comment: "c",
        }),
      },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("未登录或登录已过期");
  });

  it("should return 404 if interview does not exist", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });

    const req = new NextRequest(
      "http://localhost:3000/api/interview/save-evaluation",
      {
        method: "POST",
        body: JSON.stringify({
          interviewId: "123",
          questionId: "q1",
          questionText: "t",
          answerText: "a",
          overallScore: 5,
          comment: "c",
        }),
      },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("面试不存在");
  });

  it("should return 200 on successful save", async () => {
    const payload = {
      interviewId: "123",
      questionId: "q1",
      questionText: "t",
      answerText: "a",
      overallScore: 5,
      comment: "c",
      dimensionScores: { a: 1 },
    };

    const req = new NextRequest(
      "http://localhost:3000/api/interview/save-evaluation",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith({
      interview_id: "123",
      question_id: "q1",
      question_text: "t",
      answer_text: "a",
      overall_score: 5,
      dimension_scores: { a: 1 },
      comment: "c",
    });
  });
});

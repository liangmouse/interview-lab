import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockAuthGetUser,
  mockCreateClient,
  mockProfileSingle,
  mockInterviewSingle,
  mockEvaluationOrder,
} = vi.hoisted(() => {
  const mockAuthGetUser = vi.fn();
  const mockProfileSingle = vi.fn();
  const mockInterviewSingle = vi.fn();
  const mockEvaluationOrder = vi.fn();

  const mockCreateClient = vi.fn(async () => ({
    auth: {
      getUser: mockAuthGetUser,
    },
    from: vi.fn((table: string) => {
      if (table === "user_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockProfileSingle,
            })),
          })),
        };
      }

      if (table === "interviews") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: mockInterviewSingle,
              })),
            })),
          })),
        };
      }

      if (table === "interview_evaluations") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: mockEvaluationOrder,
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  }));

  return {
    mockAuthGetUser,
    mockCreateClient,
    mockProfileSingle,
    mockInterviewSingle,
    mockEvaluationOrder,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/billing/access", () => ({
  resolveUserAccessForUserId: vi.fn(),
}));

import { GET } from "./route";
import { resolveUserAccessForUserId } from "@/lib/billing/access";

describe("Interview Report API", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mockProfileSingle.mockResolvedValue({
      data: { id: "profile-1" },
      error: null,
    });
    mockInterviewSingle.mockResolvedValue({
      data: { id: "interview-1" },
      error: null,
    });
    mockEvaluationOrder.mockResolvedValue({
      data: [
        {
          question_id: "q1",
          question_text: "介绍一下自己",
          answer_text: "answer",
          overall_score: 88,
          dimension_scores: { logic: 90 },
          comment: "good",
        },
      ],
      error: null,
    });

    vi.mocked(resolveUserAccessForUserId).mockResolvedValue({
      tier: "free",
      trialTotal: 3,
      trialUsed: 1,
      trialRemaining: 2,
      canUsePersonalization: false,
      canViewFullReport: false,
      subscriptionStatus: "inactive",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      activeSubscriptionId: null,
    });
  });

  it("returns 404 when interview does not belong to current user", async () => {
    mockInterviewSingle.mockResolvedValue({
      data: null,
      error: { message: "Not found" },
    });

    const request = new NextRequest(
      "http://localhost:3000/api/interview/report?interviewId=interview-1",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("面试不存在");
    expect(mockEvaluationOrder).not.toHaveBeenCalled();
  });

  it("sanitizes report for free users after ownership check", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/interview/report?interviewId=interview-1",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.report).toEqual([
      {
        question_id: "q1",
        question_text: "介绍一下自己",
        overall_score: 88,
      },
    ]);
  });
});

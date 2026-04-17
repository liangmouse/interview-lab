import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCurrentUser,
  mockCreateClient,
  mockUpsertJobRecommendationFeedback,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockCreateClient: vi.fn(),
  mockUpsertJobRecommendationFeedback: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@interviewclaw/data-access", () => ({
  upsertJobRecommendationFeedback: mockUpsertJobRecommendationFeedback,
}));

import { POST } from "./route";

describe("Job Recommendation Feedback API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    mockCreateClient.mockResolvedValue({});
    mockUpsertJobRecommendationFeedback.mockResolvedValue({
      id: "feedback-1",
      userId: "user-1",
      source: "boss",
      sourceJobId: "boss-job-1",
      action: "hidden",
      jobSnapshot: {
        sourceJobId: "boss-job-1",
        title: "前端工程师",
        companyName: "某科技",
        tags: [],
        matchScore: 88,
        matchReasons: ["技能命中"],
        cautions: [],
      },
    });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);

    const request = new Request(
      "http://localhost/api/job-recommendations/feedback",
      {
        method: "POST",
        body: JSON.stringify({
          sourceJobId: "boss-job-1",
          action: "hidden",
          jobSnapshot: {
            sourceJobId: "boss-job-1",
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("未登录或登录已过期");
  });

  it("updates feedback action for a recommended job", async () => {
    const request = new Request(
      "http://localhost/api/job-recommendations/feedback",
      {
        method: "POST",
        body: JSON.stringify({
          sourceJobId: "boss-job-1",
          action: "hidden",
          jobSnapshot: {
            sourceJobId: "boss-job-1",
            title: "前端工程师",
            companyName: "某科技",
            tags: [],
            matchScore: 88,
            matchReasons: ["技能命中"],
            cautions: [],
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpsertJobRecommendationFeedback).toHaveBeenCalledWith(
      {
        userId: "user-1",
        source: "boss",
        sourceJobId: "boss-job-1",
        action: "hidden",
        jobSnapshot: {
          sourceJobId: "boss-job-1",
          title: "前端工程师",
          companyName: "某科技",
          tags: [],
          matchScore: 88,
          matchReasons: ["技能命中"],
          cautions: [],
        },
      },
      expect.any(Object),
    );
    expect(data.data.action).toBe("hidden");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCurrentUser,
  mockCreateClient,
  mockCreateQuestioningJob,
  mockListQuestioningJobsForUser,
  mockResolveUserAccessForUserId,
  mockUpsertResumeRecord,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockCreateClient: vi.fn(),
  mockCreateQuestioningJob: vi.fn(),
  mockListQuestioningJobsForUser: vi.fn(),
  mockResolveUserAccessForUserId: vi.fn(),
  mockUpsertResumeRecord: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@interviewclaw/data-access", () => ({
  createQuestioningJob: mockCreateQuestioningJob,
  listQuestioningJobsForUser: mockListQuestioningJobsForUser,
  upsertResumeRecord: mockUpsertResumeRecord,
}));

vi.mock("@/lib/billing/access", () => ({
  resolveUserAccessForUserId: mockResolveUserAccessForUserId,
}));

import { GET, POST } from "./route";

describe("Questioning Jobs API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    mockCreateClient.mockResolvedValue({
      from: vi.fn(),
      rpc: vi.fn(),
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn(() => ({
            data: { publicUrl: "https://example.com/resume.pdf" },
          })),
        })),
      },
    });
    mockListQuestioningJobsForUser.mockResolvedValue([
      { id: "job-1", status: "succeeded" },
    ]);
    mockResolveUserAccessForUserId.mockResolvedValue({
      tier: "free",
      trialTotal: 3,
      trialUsed: 0,
      trialRemaining: 3,
      canUsePersonalization: false,
      canViewFullReport: false,
      subscriptionStatus: "inactive",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      activeSubscriptionId: null,
    });
    mockUpsertResumeRecord.mockResolvedValue(undefined);
    mockCreateQuestioningJob.mockResolvedValue({
      id: "job-1",
      status: "queued",
    });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("未登录或登录已过期");
    expect(mockListQuestioningJobsForUser).not.toHaveBeenCalled();
  });

  it("returns jobs when query succeeds", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([{ id: "job-1", status: "succeeded" }]);
    expect(mockListQuestioningJobsForUser).toHaveBeenCalledWith(
      "user-1",
      20,
      expect.any(Object),
    );
  });

  it("returns empty data for transient fetch failures", async () => {
    mockListQuestioningJobsForUser.mockRejectedValue(
      new Error("Failed to list questioning jobs: TypeError: fetch failed"),
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([]);
    expect(data.warning).toBe("押题记录暂时加载失败，请稍后刷新重试");
  });

  it("consumes a trial before creating a free questioning job", async () => {
    const mockRpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: { allowed: true, trialRemaining: 2 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { success: true, trialUsed: 1 },
        error: null,
      });
    mockCreateClient.mockResolvedValue({
      from: vi.fn(),
      rpc: mockRpc,
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn(() => ({
            data: { publicUrl: "https://example.com/resume.pdf" },
          })),
        })),
      },
    });

    const request = new Request("http://localhost/api/questioning/jobs", {
      method: "POST",
      body: JSON.stringify({
        resumeId: "user-1/resume.pdf",
        targetRole: "前端工程师",
        track: "campus",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.id).toBe("job-1");
    expect(mockRpc).toHaveBeenCalledWith("consume_trial_if_available", {
      p_user_id: "user-1",
    });
    expect(mockCreateQuestioningJob).toHaveBeenCalled();
  });

  it("blocks creation when no questioning trial remains", async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: { allowed: false, trialRemaining: 0 },
      error: null,
    });
    mockCreateClient.mockResolvedValue({
      from: vi.fn(),
      rpc: mockRpc,
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn(() => ({
            data: { publicUrl: "https://example.com/resume.pdf" },
          })),
        })),
      },
    });

    const request = new Request("http://localhost/api/questioning/jobs", {
      method: "POST",
      body: JSON.stringify({
        resumeId: "user-1/resume.pdf",
        targetRole: "前端工程师",
        track: "campus",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("押题次数已用完，请升级会员后继续");
    expect(mockCreateQuestioningJob).not.toHaveBeenCalled();
  });

  it("compensates the consumed trial when job creation fails", async () => {
    const mockRpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: { allowed: true, trialRemaining: 2 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { success: true, trialUsed: 0 },
        error: null,
      });
    mockCreateClient.mockResolvedValue({
      from: vi.fn(),
      rpc: mockRpc,
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn(() => ({
            data: { publicUrl: "https://example.com/resume.pdf" },
          })),
        })),
      },
    });
    mockCreateQuestioningJob.mockRejectedValueOnce(new Error("create failed"));

    const request = new Request("http://localhost/api/questioning/jobs", {
      method: "POST",
      body: JSON.stringify({
        resumeId: "user-1/resume.pdf",
        targetRole: "前端工程师",
        track: "campus",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("押题任务创建失败，请稍后重试");
    expect(mockRpc).toHaveBeenNthCalledWith(2, "compensate_trial_consumption", {
      p_user_id: "user-1",
    });
  });
});

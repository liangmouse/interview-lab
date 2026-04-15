import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateClient,
  mockCreateResumeReviewJob,
  mockListResumeReviewJobsForUser,
  mockUpsertResumeRecord,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockCreateResumeReviewJob: vi.fn(),
  mockListResumeReviewJobsForUser: vi.fn(),
  mockUpsertResumeRecord: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@interviewclaw/data-access", () => ({
  createResumeReviewJob: mockCreateResumeReviewJob,
  listResumeReviewJobsForUser: mockListResumeReviewJobsForUser,
  upsertResumeRecord: mockUpsertResumeRecord,
}));

import { GET, POST } from "./route";

describe("Resume Review Jobs API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn(() => ({
            data: { publicUrl: "https://example.com/resume.pdf" },
          })),
        })),
      },
    });
    mockListResumeReviewJobsForUser.mockResolvedValue([
      { id: "job-1", status: "succeeded" },
    ]);
    mockUpsertResumeRecord.mockResolvedValue(undefined);
    mockCreateResumeReviewJob.mockResolvedValue({
      id: "job-1",
      status: "queued",
      payload: {
        resumeStoragePath: "user-1/resume.pdf",
        targetRole: "前端工程师",
        targetCompany: "OpenAI",
      },
    });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("未登录或登录已过期");
  });

  it("requires target role when creating a job", async () => {
    const request = new Request("http://localhost/api/resume-review/jobs", {
      method: "POST",
      body: JSON.stringify({
        resumeStoragePath: "user-1/resume.pdf",
        targetCompany: "OpenAI",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("请填写目标岗位");
    expect(mockCreateResumeReviewJob).not.toHaveBeenCalled();
  });

  it("requires target company when creating a job", async () => {
    const request = new Request("http://localhost/api/resume-review/jobs", {
      method: "POST",
      body: JSON.stringify({
        resumeStoragePath: "user-1/resume.pdf",
        targetRole: "前端工程师",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("请填写目标公司");
    expect(mockCreateResumeReviewJob).not.toHaveBeenCalled();
  });

  it("creates resume review job with target role and company", async () => {
    const request = new Request("http://localhost/api/resume-review/jobs", {
      method: "POST",
      body: JSON.stringify({
        resumeStoragePath: "user-1/resume.pdf",
        targetRole: "前端工程师",
        targetCompany: "OpenAI",
        jobDescription: "负责前端架构与工程化建设",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.id).toBe("job-1");
    expect(mockCreateResumeReviewJob).toHaveBeenCalledWith(
      {
        userId: "user-1",
        payload: {
          resumeStoragePath: "user-1/resume.pdf",
          targetRole: "前端工程师",
          targetCompany: "OpenAI",
          jobDescription: "负责前端架构与工程化建设",
        },
      },
      expect.any(Object),
    );
  });
});

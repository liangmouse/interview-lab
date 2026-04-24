import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCurrentUser,
  mockCreateResumeGenerationJob,
  mockGetResumeGenerationSessionForUser,
  mockListResumeGenerationJobsForUser,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockCreateResumeGenerationJob: vi.fn(),
  mockGetResumeGenerationSessionForUser: vi.fn(),
  mockListResumeGenerationJobsForUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@interviewclaw/data-access", () => ({
  createResumeGenerationJob: mockCreateResumeGenerationJob,
  getResumeGenerationSessionForUser: mockGetResumeGenerationSessionForUser,
  listResumeGenerationJobsForUser: mockListResumeGenerationJobsForUser,
}));

import { GET, POST } from "./route";

describe("Resume Generation Jobs API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    mockListResumeGenerationJobsForUser.mockResolvedValue([
      { id: "job-1", status: "queued" },
    ]);
    mockGetResumeGenerationSessionForUser.mockResolvedValue({
      id: "session-1",
      sessionStatus: "ready",
      sourceResumeStoragePath: "user-1/resume.pdf",
      directionPreset: "general",
      customStylePrompt: "强调结果",
      language: "zh-CN",
      portraitDraft: {
        directionPreset: "general",
        language: "zh-CN",
        skills: [],
        workExperiences: [],
        projectExperiences: [],
        rawUserNotes: [],
      },
    });
    mockCreateResumeGenerationJob.mockResolvedValue({
      id: "job-1",
      status: "queued",
    });
  });

  it("returns jobs for the current user", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toEqual([{ id: "job-1", status: "queued" }]);
  });

  it("blocks job creation when the session is not ready", async () => {
    mockGetResumeGenerationSessionForUser.mockResolvedValueOnce({
      id: "session-1",
      sessionStatus: "collecting",
    });

    const request = new Request("http://localhost/api/resume-generation/jobs", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session-1",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("当前信息还不完整，请继续补充后再生成");
    expect(mockCreateResumeGenerationJob).not.toHaveBeenCalled();
  });

  it("creates a generation job from a ready session", async () => {
    const request = new Request("http://localhost/api/resume-generation/jobs", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "session-1",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await POST(request as any);

    expect(response.status).toBe(201);
    expect(mockCreateResumeGenerationJob).toHaveBeenCalledWith({
      userId: "user-1",
      payload: expect.objectContaining({
        sessionId: "session-1",
        sourceResumeStoragePath: "user-1/resume.pdf",
      }),
    });
  });
});

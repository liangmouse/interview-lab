import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCurrentUser,
  mockCreateClient,
  mockCreateJobRecommendationJob,
  mockGetJobSourceSessionForUser,
  mockListJobRecommendationJobsForUser,
  mockLoadRecommendationUserProfile,
  mockSaveJobSearchPreferencesForUser,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockCreateClient: vi.fn(),
  mockCreateJobRecommendationJob: vi.fn(),
  mockGetJobSourceSessionForUser: vi.fn(),
  mockListJobRecommendationJobsForUser: vi.fn(),
  mockLoadRecommendationUserProfile: vi.fn(),
  mockSaveJobSearchPreferencesForUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@interviewclaw/data-access", () => ({
  createJobRecommendationJob: mockCreateJobRecommendationJob,
  getJobSourceSessionForUser: mockGetJobSourceSessionForUser,
  listJobRecommendationJobsForUser: mockListJobRecommendationJobsForUser,
  loadRecommendationUserProfile: mockLoadRecommendationUserProfile,
  saveJobSearchPreferencesForUser: mockSaveJobSearchPreferencesForUser,
}));

import { GET, POST } from "./route";

describe("Job Recommendation Jobs API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    mockCreateClient.mockResolvedValue({});
    mockGetJobSourceSessionForUser.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      source: "boss",
      status: "connected",
    });
    mockLoadRecommendationUserProfile.mockResolvedValue({
      id: "profile-1",
      userId: "user-1",
      jobSearchPreferences: {
        cities: ["上海"],
        role: "前端工程师",
        industries: [],
        companySizes: [],
      },
    });
    mockSaveJobSearchPreferencesForUser.mockResolvedValue({
      cities: ["上海"],
      role: "前端工程师",
      industries: ["AI 应用"],
      companySizes: ["100-499人"],
      salaryMinK: 25,
      salaryMaxK: 35,
    });
    mockListJobRecommendationJobsForUser.mockResolvedValue([
      { id: "job-1", status: "succeeded" },
    ]);
    mockCreateJobRecommendationJob.mockResolvedValue({
      id: "job-1",
      status: "queued",
      payload: {
        mode: "auto",
        source: "boss",
      },
    });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("未登录或登录已过期");
  });

  it("rejects auto job creation when no boss session exists", async () => {
    mockGetJobSourceSessionForUser.mockResolvedValueOnce(null);

    const request = new Request(
      "http://localhost/api/job-recommendations/jobs",
      {
        method: "POST",
        body: JSON.stringify({
          mode: "auto",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("请先导入 BOSS 登录态后再开始推荐");
    expect(mockCreateJobRecommendationJob).not.toHaveBeenCalled();
  });

  it("rejects manual job creation when no boss session exists", async () => {
    mockGetJobSourceSessionForUser.mockResolvedValueOnce(null);

    const request = new Request(
      "http://localhost/api/job-recommendations/jobs",
      {
        method: "POST",
        body: JSON.stringify({
          mode: "manual",
          manualFilters: {
            role: "前端工程师",
          },
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("请先导入 BOSS 登录态后再开始推荐");
    expect(mockCreateJobRecommendationJob).not.toHaveBeenCalled();
  });

  it("saves default preferences before creating a manual job", async () => {
    const request = new Request(
      "http://localhost/api/job-recommendations/jobs",
      {
        method: "POST",
        body: JSON.stringify({
          mode: "manual",
          manualFilters: {
            cities: ["上海"],
            salaryMinK: 25,
            salaryMaxK: 35,
            role: "前端工程师",
            industries: ["AI 应用"],
            companySizes: ["100-499人"],
          },
          savePreferences: true,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(mockSaveJobSearchPreferencesForUser).toHaveBeenCalledWith(
      {
        userId: "user-1",
        preferences: {
          cities: ["上海"],
          salaryMinK: 25,
          salaryMaxK: 35,
          role: "前端工程师",
          industries: ["AI 应用"],
          companySizes: ["100-499人"],
        },
      },
      expect.any(Object),
    );
    expect(mockCreateJobRecommendationJob).toHaveBeenCalledWith(
      {
        userId: "user-1",
        payload: {
          mode: "manual",
          source: "boss",
          manualFilters: {
            cities: ["上海"],
            salaryMinK: 25,
            salaryMaxK: 35,
            role: "前端工程师",
            industries: ["AI 应用"],
            companySizes: ["100-499人"],
          },
          savedPreferenceSnapshot: {
            cities: ["上海"],
            role: "前端工程师",
            industries: ["AI 应用"],
            companySizes: ["100-499人"],
            salaryMinK: 25,
            salaryMaxK: 35,
          },
        },
      },
      expect.any(Object),
    );
    expect(data.data.id).toBe("job-1");
  });
});

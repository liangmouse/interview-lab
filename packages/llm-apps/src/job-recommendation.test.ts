import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const withStructuredOutput = vi.fn();
const createLangChainChatModel = vi.fn(() => ({
  withStructuredOutput,
}));
const createLangChainChatModelForUseCase = vi.fn(() => ({
  withStructuredOutput,
}));

const claimNextJobRecommendationJob = vi.fn();
const completeJobRecommendationJob = vi.fn();
const failJobRecommendationJob = vi.fn();
const getJobSourceSessionWithCredentialForUser = vi.fn();
const listJobRecommendationFeedbackForUser = vi.fn();
const loadLatestResumeRecordForUser = vi.fn();
const loadRecommendationProfileVectorsForUser = vi.fn();
const loadRecommendationUserProfile = vi.fn();
const ensureResumeSnapshot = vi.fn();
const getCapabilityModelInfo = vi.fn();
const buildJobTracingContext = vi.fn();
const fetchBossRecommendedJobs = vi.fn();
const searchBossJobs = vi.fn();

const { BossRateLimitError, BossSessionInvalidError, BossUpstreamError } =
  vi.hoisted(() => {
    class RateLimitError extends Error {
      constructor(message = "BOSS 请求过于频繁，请稍后重试") {
        super(message);
        this.name = "BossRateLimitError";
      }
    }

    class SessionInvalidError extends Error {
      constructor(message = "BOSS 登录态失效，请重新导入 Cookie") {
        super(message);
        this.name = "BossSessionInvalidError";
      }
    }

    class UpstreamError extends Error {
      constructor(message = "BOSS 服务暂时不可用") {
        super(message);
        this.name = "BossUpstreamError";
      }
    }

    return {
      BossRateLimitError: RateLimitError,
      BossSessionInvalidError: SessionInvalidError,
      BossUpstreamError: UpstreamError,
    };
  });

vi.mock("@interviewclaw/ai-runtime", () => ({
  createLangChainChatModel,
  createLangChainChatModelForUseCase,
  mergeLangfuseTracingContext: (...contexts: any[]) =>
    contexts.filter(Boolean).reduce(
      (acc: any, current: any) => ({
        ...acc,
        ...current,
      }),
      {},
    ),
}));

vi.mock("@interviewclaw/data-access", () => ({
  claimNextJobRecommendationJob,
  completeJobRecommendationJob,
  failJobRecommendationJob,
  getJobSourceSessionWithCredentialForUser,
  listJobRecommendationFeedbackForUser,
  loadLatestResumeRecordForUser,
  loadRecommendationProfileVectorsForUser,
  loadRecommendationUserProfile,
}));

vi.mock("./shared", () => ({
  ensureResumeSnapshot,
  getCapabilityModelInfo,
  buildJobTracingContext,
}));

vi.mock("./boss-provider", () => ({
  BossRateLimitError,
  BossSessionInvalidError,
  BossUpstreamError,
  fetchBossRecommendedJobs,
  searchBossJobs,
}));

function buildCandidate(overrides?: Record<string, unknown>) {
  return {
    sourceJobId: "boss-job-1",
    title: "前端工程师",
    companyName: "某科技",
    city: "上海",
    salaryText: "25-35K",
    industry: "AI 应用",
    companySize: "100-499人",
    experience: "3-5年",
    degree: "本科",
    tags: ["React", "TypeScript"],
    url: "https://example.com/job/1",
    ...overrides,
  };
}

describe("llm-apps/job-recommendation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    withStructuredOutput.mockReturnValue({ invoke });
    buildJobTracingContext.mockReturnValue({});
    getCapabilityModelInfo.mockReturnValue({
      providerId: "openai",
      model: "gpt-5.4",
    });
    claimNextJobRecommendationJob.mockResolvedValue({
      id: "job-1",
      userId: "user-1",
      createdAt: "2026-04-17T00:00:00.000Z",
      payload: {
        mode: "auto",
        source: "boss",
      },
    });
    getJobSourceSessionWithCredentialForUser.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      source: "boss",
      status: "connected",
      credential: {
        cookie: "boss-cookie=1",
      },
      createdAt: "2026-04-17T00:00:00.000Z",
      updatedAt: "2026-04-17T00:00:00.000Z",
    });
    listJobRecommendationFeedbackForUser.mockResolvedValue([]);
    loadRecommendationUserProfile.mockResolvedValue({
      id: "profile-1",
      userId: "user-1",
      jobIntention: "前端工程师",
      companyIntention: "AI 公司",
      experienceYears: 4,
      skills: ["React", "TypeScript"],
      workExperiences: [],
      projectExperiences: [],
      jobSearchPreferences: {
        cities: ["上海"],
        role: "前端工程师",
        industries: ["AI 应用"],
        companySizes: ["100-499人"],
        salaryMinK: 25,
        salaryMaxK: 35,
      },
    });
    loadLatestResumeRecordForUser.mockResolvedValue({
      id: "resume-1",
      userId: "user-1",
      storagePath: "user-1/resume.pdf",
      fileName: "resume.pdf",
      fileUrl: "https://example.com/resume.pdf",
      parsedText: "熟悉 React 和 TypeScript",
      processingStatus: "completed",
      uploadedAt: "2026-04-17T00:00:00.000Z",
    });
    loadRecommendationProfileVectorsForUser.mockResolvedValue([
      {
        content: "偏好 AI 应用与成长型团队",
        metadata: {},
        updatedAt: "2026-04-17T00:00:00.000Z",
      },
    ]);
    ensureResumeSnapshot.mockResolvedValue({
      snapshot: {
        personalInfo: { name: "梁爽" },
        jobIntention: "前端工程师",
        experienceYears: 4,
        skills: ["React", "TypeScript"],
        education: null,
        workExperiences: [],
        projectExperiences: [
          {
            projectName: "推荐系统后台",
            role: "前端负责人",
            techStack: ["React", "TypeScript"],
            description: "负责复杂工作台与工程化",
          },
        ],
      },
    });
    fetchBossRecommendedJobs.mockResolvedValue([buildCandidate()]);
    searchBossJobs.mockResolvedValue([]);
    invoke.mockReset();
  });

  it("generates inferred query from profile and resume in auto mode", async () => {
    invoke
      .mockResolvedValueOnce({
        cities: ["上海"],
        salaryRange: {
          minK: 25,
          maxK: 35,
        },
        role: "前端工程师",
        industries: ["AI 应用"],
        companySizes: ["100-499人"],
        reasoning: ["优先结合已保存偏好和最新简历解析。"],
      })
      .mockResolvedValueOnce({
        summary: "推荐结果更偏向成长型 AI 团队。",
        jobs: [
          {
            sourceJobId: "boss-job-1",
            matchScore: 93,
            matchReasons: ["岗位标题与技能高度吻合"],
            cautions: ["需要进一步确认业务强度"],
          },
        ],
      });

    const { runOneJobRecommendationJob } = await import("./job-recommendation");

    await runOneJobRecommendationJob();

    expect(completeJobRecommendationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        result: expect.objectContaining({
          inferredQuery: expect.objectContaining({
            role: "前端工程师",
            cities: ["上海"],
            industries: ["AI 应用"],
          }),
          summary: "推荐结果更偏向成长型 AI 团队。",
          jobs: [
            expect.objectContaining({
              sourceJobId: "boss-job-1",
              matchScore: 93,
              matchReasons: ["岗位标题与技能高度吻合"],
            }),
          ],
        }),
      }),
    );
    expect(failJobRecommendationJob).not.toHaveBeenCalled();
  });

  it("uses manual filters as hard constraints and preserves them in the query", async () => {
    claimNextJobRecommendationJob.mockResolvedValueOnce({
      id: "job-2",
      userId: "user-1",
      createdAt: "2026-04-17T00:00:00.000Z",
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
      },
    });
    fetchBossRecommendedJobs.mockResolvedValueOnce([
      buildCandidate({
        sourceJobId: "mismatch-1",
        city: "北京",
      }),
    ]);
    searchBossJobs.mockResolvedValueOnce([
      buildCandidate({
        sourceJobId: "manual-hit-1",
      }),
      buildCandidate({
        sourceJobId: "manual-miss-1",
        salaryText: "10-15K",
      }),
    ]);
    invoke.mockResolvedValueOnce({
      summary: "手动筛选结果已按背景完成二次排序。",
      jobs: [
        {
          sourceJobId: "manual-hit-1",
          matchScore: 88,
          matchReasons: ["完全符合手动筛选条件"],
          cautions: [],
        },
      ],
    });

    const { runOneJobRecommendationJob } = await import("./job-recommendation");

    await runOneJobRecommendationJob();

    expect(searchBossJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {
          cities: ["上海"],
          salaryMinK: 25,
          salaryMaxK: 35,
          role: "前端工程师",
          industries: ["AI 应用"],
          companySizes: ["100-499人"],
        },
      }),
    );
    expect(completeJobRecommendationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-2",
        result: expect.objectContaining({
          inferredQuery: expect.objectContaining({
            role: "前端工程师",
            cities: ["上海"],
            reasoning: ["使用用户手动填写的筛选条件作为硬过滤。"],
          }),
          jobs: [
            expect.objectContaining({
              sourceJobId: "manual-hit-1",
            }),
          ],
        }),
      }),
    );
  });

  it("marks invalid boss sessions as terminal failures", async () => {
    getJobSourceSessionWithCredentialForUser.mockResolvedValueOnce({
      id: "session-1",
      userId: "user-1",
      source: "boss",
      status: "invalid",
      validationError: "BOSS 登录态已过期",
      credential: {
        cookie: "boss-cookie=1",
      },
      createdAt: "2026-04-17T00:00:00.000Z",
      updatedAt: "2026-04-17T00:00:00.000Z",
    });

    const { runOneJobRecommendationJob } = await import("./job-recommendation");

    await runOneJobRecommendationJob();

    expect(failJobRecommendationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        errorMessage: "BOSS 登录态已过期",
        terminal: true,
      }),
    );
    expect(completeJobRecommendationJob).not.toHaveBeenCalled();
  });

  it("retries later when boss upstream is rate limited", async () => {
    fetchBossRecommendedJobs.mockRejectedValueOnce(
      new BossRateLimitError("BOSS 请求过于频繁，请稍后重试"),
    );

    const { runOneJobRecommendationJob } = await import("./job-recommendation");

    await runOneJobRecommendationJob();

    expect(failJobRecommendationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        errorMessage: "BOSS 请求过于频繁，请稍后重试",
        terminal: false,
      }),
    );
  });

  it("filters out hidden and not interested jobs before generating results", async () => {
    listJobRecommendationFeedbackForUser.mockResolvedValueOnce([
      {
        id: "feedback-1",
        userId: "user-1",
        source: "boss",
        sourceJobId: "hidden-job-1",
        action: "hidden",
        jobSnapshot: {
          sourceJobId: "hidden-job-1",
          title: "隐藏职位",
          companyName: "某公司",
          tags: [],
          matchScore: 0,
          matchReasons: [],
          cautions: [],
        },
        createdAt: "2026-04-17T00:00:00.000Z",
        updatedAt: "2026-04-17T00:00:00.000Z",
      },
    ]);
    fetchBossRecommendedJobs.mockResolvedValueOnce([
      buildCandidate({
        sourceJobId: "hidden-job-1",
        title: "隐藏职位",
      }),
      buildCandidate({
        sourceJobId: "visible-job-1",
      }),
    ]);
    invoke
      .mockResolvedValueOnce({
        cities: ["上海"],
        salaryRange: {
          minK: 25,
          maxK: 35,
        },
        role: "前端工程师",
        industries: ["AI 应用"],
        companySizes: ["100-499人"],
        reasoning: ["继续沿用已保存偏好。"],
      })
      .mockResolvedValueOnce({
        summary: "过滤历史负反馈后重新排序。",
        jobs: [
          {
            sourceJobId: "visible-job-1",
            matchScore: 90,
            matchReasons: ["命中过往技能栈"],
            cautions: [],
          },
        ],
      });

    const { runOneJobRecommendationJob } = await import("./job-recommendation");

    await runOneJobRecommendationJob();

    expect(completeJobRecommendationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.objectContaining({
          jobs: [
            expect.objectContaining({
              sourceJobId: "visible-job-1",
            }),
          ],
        }),
      }),
    );
    expect(completeJobRecommendationJob).not.toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.objectContaining({
          jobs: expect.arrayContaining([
            expect.objectContaining({
              sourceJobId: "hidden-job-1",
            }),
          ]),
        }),
      }),
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUESTIONING_CONFIG } from "@interviewclaw/domain";

const invoke = vi.fn();
const withStructuredOutput = vi.fn();
const createLangChainChatModelForUseCase = vi.fn(() => ({
  withStructuredOutput,
}));

const claimNextQuestioningJob = vi.fn();
const completeQuestioningJob = vi.fn();
const failQuestioningJob = vi.fn();
const loadInterviewerProfile = vi.fn();
const loadQuestionAssets = vi.fn();
const buildCandidateProfile = vi.fn();
const createInterviewPlan = vi.fn();
const ensureResumeSnapshot = vi.fn();
const getCapabilityModelInfo = vi.fn();
const buildJobTracingContext = vi.fn();
const consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

vi.mock("@interviewclaw/ai-runtime", () => ({
  createLangChainChatModel: vi.fn(),
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
  claimNextQuestioningJob,
  completeQuestioningJob,
  failQuestioningJob,
  loadInterviewerProfile,
  loadQuestionAssets,
}));

vi.mock("@interviewclaw/agent-core", () => ({
  buildCandidateProfile,
  createInterviewPlan,
}));

vi.mock("./shared", () => ({
  buildJobTracingContext,
  ensureResumeSnapshot,
  getCapabilityModelInfo,
}));

describe("llm-apps/questioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withStructuredOutput.mockReturnValue({ invoke });
    buildJobTracingContext.mockReturnValue({});
    getCapabilityModelInfo.mockReturnValue({
      providerId: "openrouter",
      model: "anthropic/claude-sonnet-4.6",
    });
    claimNextQuestioningJob.mockResolvedValue({
      id: "job-1",
      userId: "user-1",
      createdAt: "2026-03-24T00:00:00.000Z",
      payload: {
        resumeStoragePath: "user-1/resume.pdf",
        targetRole: "前端工程师",
        track: "social",
        workExperience: "3",
        targetCompany: "某公司",
        jobDescription: "熟悉 React",
      },
    });
    ensureResumeSnapshot.mockResolvedValue({
      snapshot: {
        personalInfo: { name: "张三" },
        jobIntention: "前端工程师",
        experienceYears: 3,
        skills: ["React"],
        education: null,
        workExperiences: [],
        projectExperiences: [],
      },
    });
    buildCandidateProfile.mockReturnValue({
      roleFamily: "frontend",
      seniority: "mid",
    });
    loadQuestionAssets.mockResolvedValue([
      {
        id: "asset-1",
      },
    ]);
    loadInterviewerProfile.mockResolvedValue(null);
    createInterviewPlan.mockReturnValue({
      questions: [
        {
          questionType: "project",
          questionText: "介绍一个你最熟悉的项目",
          topics: ["React"],
        },
      ],
    });
    invoke.mockResolvedValue({
      summary: "总结",
      highlights: ["A", "B", "C"],
      questions: [
        {
          question: "介绍一下项目",
          category: "项目经历",
          answerGuide: "按 STAR 回答",
          referenceAnswer: "参考答案",
          followUps: ["追问 1"],
        },
      ],
    });
  });

  it("uses function calling for structured questioning output", async () => {
    const { runOneQuestioningJob } = await import("./questioning");

    await runOneQuestioningJob();

    expect(createLangChainChatModelForUseCase).toHaveBeenCalled();
    expect(withStructuredOutput).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: "functionCalling",
      }),
    );
    expect(completeQuestioningJob).toHaveBeenCalledTimes(1);
    expect(failQuestioningJob).not.toHaveBeenCalled();
  });

  it("uses the fixed long timeout for questioning generation", async () => {
    const { runOneQuestioningJob } = await import("./questioning");

    await runOneQuestioningJob();

    expect(createLangChainChatModelForUseCase).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: QUESTIONING_CONFIG.generationTimeoutMs,
      }),
    );
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[questioning-worker] llm invoke start",
      expect.objectContaining({
        timeoutMs: QUESTIONING_CONFIG.generationTimeoutMs,
      }),
    );
  });

  it("marks provider routing and tool choice errors as terminal failures", async () => {
    const { runOneQuestioningJob } = await import("./questioning");
    invoke.mockRejectedValueOnce(
      new Error(
        "404 No endpoints found that support the provided 'tool_choice' value",
      ),
    );

    await runOneQuestioningJob();

    expect(failQuestioningJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        terminal: true,
      }),
    );
  });
});

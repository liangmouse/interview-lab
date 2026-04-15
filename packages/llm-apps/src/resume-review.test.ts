import { beforeEach, describe, expect, it, vi } from "vitest";

const withStructuredOutput = vi.fn();
const invoke = vi.fn();
const openAIResponsesCreate = vi.fn();
const claimNextResumeReviewJob = vi.fn();
const completeResumeReviewJob = vi.fn();
const failResumeReviewJob = vi.fn();
const ensureResumeSnapshot = vi.fn();
const getCapabilityModelInfo = vi.fn();
const createOpenAIProvider = vi.fn(() => ({
  createOpenAIClient: vi.fn(() => ({
    responses: {
      create: openAIResponsesCreate,
    },
  })),
}));
const resolveOpenAICompatibleProviderConfig = vi.fn();

const createLangChainChatModel = vi.fn(() => ({
  withStructuredOutput,
}));
const createLangChainChatModelForUseCase = vi.fn(() => ({
  withStructuredOutput,
}));

vi.mock("@interviewclaw/ai-runtime", () => ({
  createLangChainChatModel,
  createLangChainChatModelForUseCase,
  createOpenAIProvider,
  mergeLangfuseTracingContext: (...contexts: any[]) =>
    contexts.filter(Boolean).reduce(
      (acc: any, current: any) => ({
        ...acc,
        ...current,
      }),
      {},
    ),
  resolveOpenAICompatibleProviderConfig,
}));

vi.mock("@interviewclaw/data-access", () => ({
  claimNextResumeReviewJob,
  completeResumeReviewJob,
  failResumeReviewJob,
}));

vi.mock("./shared", () => ({
  buildJobTracingContext: vi.fn(() => ({ traceId: "trace-1" })),
  ensureResumeSnapshot,
  getCapabilityModelInfo,
}));

describe("llm-apps/resume-review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withStructuredOutput.mockReturnValue({ invoke });
    getCapabilityModelInfo.mockReturnValue({
      providerId: "openai",
      model: "gpt-5.4",
    });
    claimNextResumeReviewJob.mockResolvedValue({
      id: "job-1",
      userId: "user-1",
      status: "queued",
      payload: {
        resumeStoragePath: "user-1/resume.pdf",
        targetRole: "前端工程师",
        targetCompany: "OpenAI",
        jobDescription: "负责 AI Agent 前端工程化",
      },
      createdAt: new Date().toISOString(),
    });
    ensureResumeSnapshot.mockResolvedValue({
      record: {
        fileName: "resume.pdf",
        fileUrl: "https://cdn.example.com/resume.pdf",
        parsedText: "HTML0 CSS< React ./.0./0",
      },
      snapshot: {
        skills: ["React", "TypeScript"],
        workExperiences: [],
        projectExperiences: [],
      },
      qualityReport: {
        isLowConfidence: true,
        reasons: [
          "文本中存在多处疑似乱码/损坏关键词，应降低基于原文细节的判断置信度。",
        ],
        privateUseGlyphCount: 0,
        suspiciousTokenCount: 4,
        malformedDateCount: 1,
      },
    });
    invoke.mockResolvedValue({
      overallScore: 70,
      overallAssessment: "简历具备一定基础。",
      sections: [],
      atsCompatibility: {
        score: 60,
        issues: [],
        recommendations: [],
      },
    });
    resolveOpenAICompatibleProviderConfig.mockReturnValue({
      providerId: "openai",
      apiKey: "sk-test",
      baseURL: "https://api.openai.com/v1",
      model: "gpt-4.1",
    });
    openAIResponsesCreate.mockResolvedValue({
      output_text: JSON.stringify({
        score: 78,
        summary: "版式整体清晰，但顶部信息密度偏高。",
        strengths: ["模块分区清楚"],
        issues: ["顶部联系方式区域过于拥挤"],
        suggestions: ["将个人信息拆成两行展示"],
      }),
    });
    completeResumeReviewJob.mockResolvedValue(undefined);
    failResumeReviewJob.mockResolvedValue(undefined);
  });

  it("passes extraction-quality context into the review prompt", async () => {
    const { runOneResumeReviewJob } = await import("./resume-review");

    await runOneResumeReviewJob();

    expect(createLangChainChatModelForUseCase).toHaveBeenCalledWith(
      expect.objectContaining({
        useCase: "report-generate",
        temperature: 0.1,
      }),
    );
    expect(withStructuredOutput).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: "jsonSchema",
        strict: true,
      }),
    );
    expect(invoke).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining(
            "必须严格区分“候选人简历本身的问题”和“本次文本抽取造成的噪声”",
          ),
        }),
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("文本提取质量：低置信度"),
        }),
      ]),
    );
    expect(completeResumeReviewJob).toHaveBeenCalled();
  });

  it("attaches resume pdf for layout review when openai is configured", async () => {
    const { runOneResumeReviewJob } = await import("./resume-review");

    await runOneResumeReviewJob();

    expect(resolveOpenAICompatibleProviderConfig).toHaveBeenCalledWith({
      providerId: "openai",
      defaultModel: "gpt-4.1",
    });
    expect(openAIResponsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4.1",
        input: [
          expect.objectContaining({
            role: "user",
            content: expect.arrayContaining([
              expect.objectContaining({
                type: "input_text",
                text: expect.stringContaining("目标公司：OpenAI"),
              }),
              expect.objectContaining({
                type: "input_file",
                file_url: "https://cdn.example.com/resume.pdf",
                filename: "resume.pdf",
              }),
            ]),
          }),
        ],
      }),
    );
    expect(completeResumeReviewJob).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.objectContaining({
          layoutReview: expect.objectContaining({
            score: 78,
          }),
        }),
      }),
    );
  });
});

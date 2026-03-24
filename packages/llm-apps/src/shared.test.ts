import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveOpenAICompatibleConfig = vi.fn();
const resolveAiModelRoute = vi.fn();
const withStructuredOutput = vi.fn();
const invoke = vi.fn();
const getResumeRecordByStoragePath = vi.fn();
const getSupabaseAdminClient = vi.fn();
const upsertResumeRecord = vi.fn();

vi.mock("@interviewclaw/ai-runtime", () => ({
  createLangChainChatModel: vi.fn(() => ({
    withStructuredOutput,
  })),
  mergeLangfuseTracingContext: (...contexts: any[]) =>
    contexts.filter(Boolean).reduce(
      (acc: any, current: any) => ({
        ...acc,
        ...current,
      }),
      {},
    ),
  resolveOpenAICompatibleConfig,
  resolveAiModelRoute,
}));

vi.mock("@interviewclaw/data-access", () => ({
  getResumeRecordByStoragePath,
  getSupabaseAdminClient,
  upsertResumeRecord,
}));

vi.mock("unpdf", () => ({
  extractText: vi.fn(),
}));

describe("llm-apps/shared.getCapabilityModelInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.QUESTIONING_MODEL;
    withStructuredOutput.mockReturnValue({ invoke });
    getSupabaseAdminClient.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn(() => ({
            data: { publicUrl: "https://example.com/resume.pdf" },
          })),
        })),
      },
    });
    upsertResumeRecord.mockImplementation(async (input: any) => ({
      id: "resume-1",
      userId: input.userId,
      storagePath: input.storagePath,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      parsedText: input.parsedText,
      parsedJson: input.parsedJson,
      processingStatus: input.processingStatus ?? "completed",
      uploadedAt: new Date().toISOString(),
      lastProcessedAt: input.lastProcessedAt,
    }));
  });

  it("uses the explicit env model when configured", async () => {
    process.env.QUESTIONING_MODEL = "anthropic/claude-sonnet-4.6";
    resolveOpenAICompatibleConfig.mockReturnValue({
      providerId: "openrouter",
      model: "anthropic/claude-sonnet-4.6",
    });

    const { getCapabilityModelInfo } = await import("./shared");
    const result = getCapabilityModelInfo({
      envModelKey: "QUESTIONING_MODEL",
      useCase: "question-predict",
    });

    expect(resolveOpenAICompatibleConfig).toHaveBeenCalledWith({
      defaultModel: "anthropic/claude-sonnet-4.6",
    });
    expect(resolveAiModelRoute).not.toHaveBeenCalled();
    expect(result).toEqual({
      providerId: "openrouter",
      model: "anthropic/claude-sonnet-4.6",
    });
  });

  it("uses the use-case route when no explicit env model is configured", async () => {
    resolveAiModelRoute.mockReturnValue({
      providerId: "openrouter",
      model: "anthropic/claude-sonnet-4.6",
    });

    const { getCapabilityModelInfo } = await import("./shared");
    const result = getCapabilityModelInfo({
      envModelKey: "QUESTIONING_MODEL",
      useCase: "question-predict",
    });

    expect(resolveAiModelRoute).toHaveBeenCalledWith({
      useCase: "question-predict",
      userTier: undefined,
    });
    expect(result).toEqual({
      providerId: "openrouter",
      model: "anthropic/claude-sonnet-4.6",
    });
  });

  it("uses function calling for structured resume snapshot output", async () => {
    invoke.mockResolvedValue({
      personalInfo: null,
      jobIntention: null,
      experienceYears: null,
      skills: [],
      education: null,
      workExperiences: [],
      projectExperiences: [],
    });

    const { analyzeResumeSnapshot } = await import("./shared");
    await analyzeResumeSnapshot("候选人简历内容");

    expect(withStructuredOutput).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: "functionCalling",
      }),
    );
  });

  it("rebuilds snapshot when cached parsedJson is invalid", async () => {
    getResumeRecordByStoragePath.mockResolvedValue({
      id: "resume-1",
      userId: "user-1",
      storagePath: "user-1/resume.pdf",
      fileName: "resume.pdf",
      fileUrl: "https://example.com/resume.pdf",
      parsedText: "候选人有 React 项目经验和前端实习经历",
      parsedJson: {
        summary: "okdone",
      },
      processingStatus: "uploaded",
      uploadedAt: new Date().toISOString(),
    });
    invoke.mockResolvedValue({
      jobIntention: "前端工程师",
      skills: ["React", "TypeScript"],
      projectExperiences: [
        {
          projectName: "智能体平台",
          role: "前端开发",
          startDate: null,
          endDate: null,
          techStack: ["React"],
          description: "负责 Agent 前端界面开发",
        },
      ],
    });

    const { ensureResumeSnapshot } = await import("./shared");
    const result = await ensureResumeSnapshot("user-1", "user-1/resume.pdf");

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(upsertResumeRecord).toHaveBeenCalledTimes(1);
    expect(result.snapshot.skills).toEqual(["React", "TypeScript"]);
  });

  it("fails fast when rebuilt snapshot is empty", async () => {
    getResumeRecordByStoragePath.mockResolvedValue({
      id: "resume-1",
      userId: "user-1",
      storagePath: "user-1/resume.pdf",
      fileName: "resume.pdf",
      fileUrl: "https://example.com/resume.pdf",
      parsedText: "候选人简历原文",
      parsedJson: {
        summary: "okdone",
      },
      processingStatus: "uploaded",
      uploadedAt: new Date().toISOString(),
    });
    invoke.mockResolvedValue({});

    const { ensureResumeSnapshot } = await import("./shared");

    await expect(
      ensureResumeSnapshot("user-1", "user-1/resume.pdf"),
    ).rejects.toThrow("简历解析结果为空，无法生成个性化押题");
  });
});

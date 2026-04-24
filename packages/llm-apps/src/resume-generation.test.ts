import { beforeEach, describe, expect, it, vi } from "vitest";

const withStructuredOutput = vi.fn();
const invoke = vi.fn();
const claimNextResumeGenerationJob = vi.fn();
const completeResumeGenerationJob = vi.fn();
const createResumeVersion = vi.fn();
const failResumeGenerationJob = vi.fn();
const getSupabaseAdminClient = vi.fn();
const ensureResumeSnapshot = vi.fn();
const getCapabilityModelInfo = vi.fn();

vi.mock("@interviewclaw/ai-runtime", () => ({
  createLangChainChatModelForUseCase: vi.fn(() => ({
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
}));

vi.mock("@interviewclaw/data-access", () => ({
  claimNextResumeGenerationJob,
  completeResumeGenerationJob,
  createResumeVersion,
  failResumeGenerationJob,
  getSupabaseAdminClient,
}));

vi.mock("./shared", () => ({
  buildJobTracingContext: vi.fn(() => ({ traceId: "trace-1" })),
  ensureResumeSnapshot,
  getCapabilityModelInfo,
}));

describe("llm-apps/resume-generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withStructuredOutput.mockReturnValue({ invoke });
    invoke
      .mockResolvedValueOnce({
        assistantQuestion: "请补充目标岗位",
        suggestedAnswerHints: ["岗位名称", "方向"],
      })
      .mockResolvedValueOnce({
        sourceResumeName: "resume.pdf",
        directionPreset: "hardcore-tech",
        language: "zh-CN",
        targetRole: "高级前端工程师",
        summary: "5 年前端经验，负责复杂平台建设。",
        personalInfo: {
          name: "梁爽",
          email: "ls@example.com",
          phone: "13800000000",
        },
        education: {
          school: "示例大学",
          major: "软件工程",
          degree: "本科",
        },
        skills: ["React", "TypeScript"],
        workExperiences: [
          {
            company: "OpenAI",
            position: "前端工程师",
            summary: "负责 AI 平台前端建设",
            highlights: ["性能优化 30%"],
          },
        ],
        projectExperiences: [],
        rawUserNotes: [],
      })
      .mockResolvedValueOnce({
        title: "梁爽 | 高级前端工程师",
        summary: "聚焦 AI 平台与复杂前端工程化。",
        markdown: "# 梁爽\n\n## 核心优势\n\n- 负责 AI 平台建设",
      });
    getCapabilityModelInfo.mockReturnValue({
      providerId: "openai",
      model: "gpt-5.4",
    });
    claimNextResumeGenerationJob.mockResolvedValue({
      id: "job-1",
      userId: "user-1",
      status: "queued",
      payload: {
        sourceResumeStoragePath: "user-1/resume.pdf",
        directionPreset: "hardcore-tech",
        customStylePrompt: "强调 AI 项目",
        language: "zh-CN",
        portraitSnapshot: {
          directionPreset: "hardcore-tech",
          language: "zh-CN",
          skills: ["React"],
          workExperiences: [],
          projectExperiences: [],
          rawUserNotes: [],
        },
        sessionId: "session-1",
      },
      createdAt: new Date().toISOString(),
    });
    ensureResumeSnapshot.mockResolvedValue({
      record: {
        fileName: "resume.pdf",
      },
      snapshot: {
        personalInfo: {
          name: "梁爽",
        },
        jobIntention: "前端工程师",
        skills: ["React", "TypeScript"],
        education: {
          school: "示例大学",
        },
        workExperiences: [],
        projectExperiences: [],
      },
    });
    getSupabaseAdminClient.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn().mockResolvedValue({ error: null }),
        })),
      },
    });
    createResumeVersion.mockResolvedValue({
      id: "version-1",
      title: "梁爽 | 高级前端工程师",
      summary: "聚焦 AI 平台与复杂前端工程化。",
      markdownContent: "# 梁爽",
      markdownStoragePath: "generated/user-1/version-1.md",
    });
    completeResumeGenerationJob.mockResolvedValue(undefined);
    failResumeGenerationJob.mockResolvedValue(undefined);
  });

  it("collects missing fields from an incomplete portrait", async () => {
    const { collectResumeGenerationMissingFields } = await import(
      "./resume-generation"
    );

    const missing = collectResumeGenerationMissingFields({
      directionPreset: "general",
      language: "zh-CN",
      skills: [],
      workExperiences: [],
      projectExperiences: [],
      rawUserNotes: [],
    });

    expect(missing).toEqual([
      "targetRole",
      "summary",
      "experience",
      "skills",
      "education",
      "contact",
    ]);
  });

  it("treats education notes collected from the user as education info", async () => {
    const { collectResumeGenerationMissingFields } = await import(
      "./resume-generation"
    );

    const missing = collectResumeGenerationMissingFields({
      directionPreset: "general",
      language: "zh-CN",
      education: {
        extraNotes: ["示例大学，软件工程，本科，2024 年毕业"],
      },
      skills: [],
      workExperiences: [],
      projectExperiences: [],
      rawUserNotes: [],
    });

    expect(missing).not.toContain("education");
  });

  it("builds an initial session draft from the parsed resume snapshot", async () => {
    const { createResumeGenerationSessionDraft } = await import(
      "./resume-generation"
    );

    const result = await createResumeGenerationSessionDraft({
      userId: "user-1",
      sourceResumeStoragePath: "user-1/resume.pdf",
      directionPreset: "hardcore-tech",
      customStylePrompt: "强调 AI 项目",
      language: "zh-CN",
    });

    expect(result.sessionStatus).toBe("collecting");
    expect(result.portraitDraft.targetRole).toBe("前端工程师");
    expect(result.assistantQuestion).toBe("请补充目标岗位");
    expect(result.messages).toHaveLength(1);
  });

  it("claims and completes a generation job with markdown output", async () => {
    const { runOneResumeGenerationJob } = await import("./resume-generation");

    const version = await runOneResumeGenerationJob();

    expect(createResumeVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sessionId: "session-1",
        previewSlug: "job-1",
        markdownStoragePath: "generated/user-1/job-1.md",
        title: "梁爽 | 高级前端工程师",
      }),
    );
    expect(completeResumeGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        result: expect.objectContaining({
          versionId: "version-1",
          previewUrl: "/resume-generation/versions/version-1",
        }),
      }),
    );
    expect(version).toEqual(expect.objectContaining({ id: "version-1" }));
  });
});

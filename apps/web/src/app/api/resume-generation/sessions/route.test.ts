import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCurrentUser,
  mockCreateResumeGenerationSession,
  mockCreateResumeGenerationSessionDraft,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockCreateResumeGenerationSession: vi.fn(),
  mockCreateResumeGenerationSessionDraft: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@interviewclaw/data-access", () => ({
  createResumeGenerationSession: mockCreateResumeGenerationSession,
}));

vi.mock("@interviewclaw/llm-apps", () => ({
  createResumeGenerationSessionDraft: mockCreateResumeGenerationSessionDraft,
}));

import { POST } from "./route";

describe("Resume Generation Sessions API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    mockCreateResumeGenerationSessionDraft.mockResolvedValue({
      sessionStatus: "collecting",
      portraitDraft: {
        directionPreset: "general",
        language: "zh-CN",
        skills: [],
        workExperiences: [],
        projectExperiences: [],
        rawUserNotes: [],
      },
      missingFields: ["summary"],
      assistantQuestion: "请补充核心优势",
      suggestedAnswerHints: ["年限", "结果"],
      messages: [
        {
          role: "assistant",
          content: "请补充核心优势",
          createdAt: "2026-04-22T00:00:00.000Z",
        },
      ],
    });
    mockCreateResumeGenerationSession.mockResolvedValue({
      id: "session-1",
      sessionStatus: "collecting",
    });
  });

  it("returns 401 when user is unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const request = new Request(
      "http://localhost/api/resume-generation/sessions",
      {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const response = await POST(request as any);
    expect(response.status).toBe(401);
  });

  it("validates resume ownership", async () => {
    const request = new Request(
      "http://localhost/api/resume-generation/sessions",
      {
        method: "POST",
        body: JSON.stringify({
          sourceResumeStoragePath: "user-2/resume.pdf",
          directionPreset: "general",
          language: "zh-CN",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("请选择有效简历");
  });

  it("creates a new generation session", async () => {
    const request = new Request(
      "http://localhost/api/resume-generation/sessions",
      {
        method: "POST",
        body: JSON.stringify({
          sourceResumeStoragePath: "user-1/resume.pdf",
          directionPreset: "general",
          customStylePrompt: "强调结果",
          language: "zh-CN",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const response = await POST(request as any);

    expect(response.status).toBe(201);
    expect(mockCreateResumeGenerationSessionDraft).toHaveBeenCalledWith({
      userId: "user-1",
      sourceResumeStoragePath: "user-1/resume.pdf",
      directionPreset: "general",
      customStylePrompt: "强调结果",
      language: "zh-CN",
    });
    expect(mockCreateResumeGenerationSession).toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";

const { getSupabaseAdminClient } = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("./supabase-admin", () => ({
  getSupabaseAdminClient,
}));

import {
  claimNextResumeGenerationJob,
  createResumeVersion,
  createResumeGenerationSession,
} from "./resume-generation-data";

describe("createResumeGenerationSession", () => {
  it("persists the generated session payload", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "session-1",
        user_id: "user-1",
        source_resume_storage_path: "user-1/resume.pdf",
        direction_preset: "general",
        custom_style_prompt: "强调结果",
        language: "zh-CN",
        session_status: "collecting",
        portrait_draft: {
          directionPreset: "general",
          language: "zh-CN",
          skills: [],
          workExperiences: [],
          projectExperiences: [],
          rawUserNotes: [],
        },
        missing_fields: ["summary"],
        assistant_question: "请补充核心优势",
        suggested_answer_hints: ["年限", "结果"],
        messages: [],
        created_at: "2026-04-22T00:00:00.000Z",
        updated_at: "2026-04-22T00:00:00.000Z",
      },
      error: null,
    });
    const insert = vi.fn(() => ({
      select: vi.fn(() => ({
        single,
      })),
    }));
    const client = {
      from: vi.fn(() => ({
        insert,
      })),
    } as any;

    const session = await createResumeGenerationSession(
      {
        userId: "user-1",
        sourceResumeStoragePath: "user-1/resume.pdf",
        directionPreset: "general",
        customStylePrompt: "强调结果",
        language: "zh-CN",
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
      },
      client,
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        source_resume_storage_path: "user-1/resume.pdf",
      }),
    );
    expect(session.id).toBe("session-1");
  });
});

describe("claimNextResumeGenerationJob", () => {
  it("only claims queued jobs", async () => {
    const staleLt = vi.fn().mockResolvedValue({ error: null });
    const staleEq = vi.fn(() => ({
      lt: staleLt,
    }));
    const staleUpdate = vi.fn(() => ({
      eq: staleEq,
    }));

    const limit = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const order = vi.fn(() => ({
      limit,
    }));
    const lte = vi.fn(() => ({
      order,
    }));
    const inStatus = vi.fn(() => ({
      lte,
    }));
    const select = vi.fn(() => ({
      in: inStatus,
    }));

    getSupabaseAdminClient.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce({
          update: staleUpdate,
        })
        .mockReturnValueOnce({
          select,
        }),
    });

    await claimNextResumeGenerationJob();

    expect(inStatus).toHaveBeenCalledWith("status", ["queued"]);
  });
});

describe("createResumeVersion", () => {
  it("upserts by preview slug so job retries do not create duplicate versions", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "version-1",
        user_id: "user-1",
        session_id: "session-1",
        source_resume_storage_path: "user-1/resume.pdf",
        direction_preset: "general",
        custom_style_prompt: null,
        language: "zh-CN",
        title: "新版简历",
        summary: "摘要",
        preview_slug: "job-1",
        markdown_storage_path: "generated/user-1/job-1.md",
        markdown_content: "# 新版简历",
        created_at: "2026-04-22T00:00:00.000Z",
        updated_at: "2026-04-22T00:00:00.000Z",
      },
      error: null,
    });
    const upsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single,
      })),
    }));
    const client = {
      from: vi.fn(() => ({
        upsert,
      })),
    } as any;

    const version = await createResumeVersion(
      {
        userId: "user-1",
        sessionId: "session-1",
        sourceResumeStoragePath: "user-1/resume.pdf",
        directionPreset: "general",
        language: "zh-CN",
        title: "新版简历",
        summary: "摘要",
        previewSlug: "job-1",
        markdownStoragePath: "generated/user-1/job-1.md",
        markdownContent: "# 新版简历",
      },
      client,
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        preview_slug: "job-1",
        markdown_storage_path: "generated/user-1/job-1.md",
      }),
      { onConflict: "preview_slug" },
    );
    expect(version.previewSlug).toBe("job-1");
  });
});

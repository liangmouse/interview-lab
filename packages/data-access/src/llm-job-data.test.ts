import { describe, expect, it, vi } from "vitest";

const { getSupabaseAdminClient } = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("./supabase-admin", () => ({
  getSupabaseAdminClient,
}));

import {
  claimNextResumeReviewJob,
  claimNextQuestioningJob,
  sanitizeDatabaseValue,
  upsertResumeRecord,
} from "./llm-job-data";

describe("sanitizeDatabaseValue", () => {
  it("removes NUL characters and replaces lone surrogate code units", () => {
    expect(sanitizeDatabaseValue("a\u0000b")).toBe("ab");
    expect(sanitizeDatabaseValue("x\uD800y")).toBe("x\uFFFDy");
    expect(sanitizeDatabaseValue("x\uDC00y")).toBe("x\uFFFDy");
    expect(sanitizeDatabaseValue("ok\uD83D\uDE00")).toBe("ok\uD83D\uDE00");
  });

  it("sanitizes nested arrays and objects recursively", () => {
    expect(
      sanitizeDatabaseValue({
        text: "a\u0000b",
        nested: {
          items: ["x\u0000y", "z\uD800w"],
        },
      }),
    ).toEqual({
      text: "ab",
      nested: {
        items: ["xy", "z\uFFFDw"],
      },
    });
  });
});

describe("upsertResumeRecord", () => {
  it("sanitizes parsed text and parsed json before upsert", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "resume-1",
        user_id: "user-1",
        file_url: "https://example.com/resume.pdf",
        parsed_text: "ab",
        uploaded_at: "2026-03-23T00:00:00.000Z",
        storage_path: "user-1/resume.pdf",
        file_name: "resume.pdf",
        parsed_json: { summary: "xy" },
        processing_status: "completed",
        last_processed_at: "2026-03-23T00:00:00.000Z",
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

    await upsertResumeRecord(
      {
        userId: "user-1",
        storagePath: "user-1/resume.pdf",
        fileUrl: "https://example.com/resume.pdf",
        fileName: "resume.pdf",
        parsedText: "a\u0000b",
        parsedJson: {
          summary: "x\u0000y",
          nested: ["z\uD800w"],
        },
        processingStatus: "completed",
        lastProcessedAt: "2026-03-23T00:00:00.000Z",
      },
      client,
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        parsed_text: "ab",
        parsed_json: {
          summary: "xy",
          nested: ["z\uFFFDw"],
        },
      }),
      { onConflict: "storage_path" },
    );
  });
});

describe("claimNextQuestioningJob", () => {
  it("only claims queued jobs and never reclaims failed jobs", async () => {
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

    await claimNextQuestioningJob();

    expect(inStatus).toHaveBeenCalledWith("status", ["queued"]);
  });
});

describe("claimNextResumeReviewJob", () => {
  it("only claims queued jobs and never reclaims failed jobs", async () => {
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

    await claimNextResumeReviewJob();

    expect(inStatus).toHaveBeenCalledWith("status", ["queued"]);
  });
});

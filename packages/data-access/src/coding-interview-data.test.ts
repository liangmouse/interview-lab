import { describe, expect, it, vi } from "vitest";
import {
  createCodingInterviewDataAccess,
  type UpsertCodingInterviewSessionInput,
} from "./coding-interview-data";

describe("coding-interview-data", () => {
  it("loads and maps a stored coding interview session", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "session-1",
        interview_id: "interview-1",
        generation_source: "llm",
        problems: [{ title: "题目一" }],
        draft_state: { activeProblemIndex: 1 },
        created_at: "2026-04-10T00:00:00.000Z",
        updated_at: "2026-04-10T00:00:10.000Z",
      },
      error: null,
    });

    const access = createCodingInterviewDataAccess({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle }),
        }),
        upsert: vi.fn(),
        update: vi.fn(() => ({ eq: vi.fn() })),
      }),
    });

    await expect(
      access.loadCodingInterviewSession("interview-1"),
    ).resolves.toEqual({
      id: "session-1",
      interviewId: "interview-1",
      generationSource: "llm",
      problems: [{ title: "题目一" }],
      draftState: { activeProblemIndex: 1 },
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:10.000Z",
    });
  });

  it("upserts a generated coding interview session by interview_id", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });

    const access = createCodingInterviewDataAccess({
      from: () => ({
        select: vi.fn(),
        upsert,
        update: vi.fn(() => ({ eq: vi.fn() })),
      }),
    });

    const input: UpsertCodingInterviewSessionInput = {
      interviewId: "interview-2",
      generationSource: "fallback",
      problems: [{ title: "题目二" }],
      draftState: { activeTab: "solution" },
    };

    await expect(
      access.upsertCodingInterviewSession(input),
    ).resolves.toBeUndefined();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      interview_id: "interview-2",
      generation_source: "fallback",
      problems: [{ title: "题目二" }],
      draft_state: { activeTab: "solution" },
    });
    expect(upsert.mock.calls[0]?.[1]).toEqual({ onConflict: "interview_id" });
  });

  it("updates only the draft state when autosaving editor progress", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));

    const access = createCodingInterviewDataAccess({
      from: () => ({
        select: vi.fn(),
        upsert: vi.fn(),
        update,
      }),
    });

    await expect(
      access.saveCodingInterviewDraftState("interview-3", {
        activeProblemIndex: 2,
      }),
    ).resolves.toBeUndefined();

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        draft_state: { activeProblemIndex: 2 },
      }),
    );
    expect(eq).toHaveBeenCalledWith("interview_id", "interview-3");
  });
});

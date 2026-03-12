import { describe, expect, it, vi } from "vitest";
import {
  createInterviewDataAccess,
  normalizeInterviewMessages,
} from "./interview-data";

describe("createInterviewDataAccess", () => {
  it("loads user profile and interview context through the shared client", async () => {
    const single = vi
      .fn()
      .mockResolvedValueOnce({
        data: { user_id: "user-1", nickname: "Alice" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: "interview-1", type: "frontend:mid" },
        error: null,
      });

    const select = vi.fn(() => ({
      eq: vi.fn(() => ({
        single,
      })),
    }));

    const dataAccess = createInterviewDataAccess({
      from: vi.fn(() => ({
        select,
      })),
      rpc: vi.fn(),
    });

    await expect(dataAccess.loadUserProfile("user-1")).resolves.toEqual({
      user_id: "user-1",
      nickname: "Alice",
    });
    await expect(dataAccess.loadInterview("interview-1")).resolves.toEqual({
      id: "interview-1",
      type: "frontend:mid",
    });
  });

  it("falls back to the legacy messages table when embedded arrays are empty", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { user_messages: [], ai_messages: [] },
      error: null,
    });
    const order = vi.fn().mockResolvedValue({
      data: [{ role: "assistant", content: "legacy message" }],
      error: null,
    });

    const dataAccess = createInterviewDataAccess({
      from: vi.fn((table: string) => {
        if (table === "interviews") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single,
              })),
            })),
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order,
            })),
          })),
        };
      }),
      rpc: vi.fn(),
    });

    await expect(
      dataAccess.loadInterviewMessages("interview-1"),
    ).resolves.toEqual([{ role: "assistant", content: "legacy message" }]);
  });

  it("persists user and ai messages through shared RPC helpers", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const dataAccess = createInterviewDataAccess({
      from: vi.fn(),
      rpc,
    });

    await dataAccess.saveUserMessage("interview-1", " hello ");
    await dataAccess.saveAiMessage("interview-1", " world ");

    expect(rpc).toHaveBeenNthCalledWith(1, "add_user_message", {
      p_interview_id: "interview-1",
      p_content: "hello",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "add_ai_message", {
      p_interview_id: "interview-1",
      p_content: "world",
    });
  });
});

describe("normalizeInterviewMessages", () => {
  it("sorts embedded user and ai message arrays into a single timeline", () => {
    const normalized = normalizeInterviewMessages({
      user_messages: [
        { content: "user-2", timestamp: "2026-03-12T10:01:00.000Z" },
        { content: "user-1", timestamp: "2026-03-12T10:00:00.000Z" },
      ],
      ai_messages: [{ content: "ai-1", timestamp: "2026-03-12T10:00:30.000Z" }],
    });

    expect(normalized.map((message) => message.content)).toEqual([
      "user-1",
      "ai-1",
      "user-2",
    ]);
  });
});

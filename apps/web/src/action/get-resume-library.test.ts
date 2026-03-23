import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCurrentUser,
  mockCreateClient,
  mockRecordsOrder,
  mockStorageList,
  mockGetPublicUrl,
} = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();
  const mockRecordsOrder = vi.fn();
  const mockStorageList = vi.fn();
  const mockGetPublicUrl = vi.fn();

  const mockCreateClient = vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table !== "resumes") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            not: vi.fn(() => ({
              order: mockRecordsOrder,
            })),
          })),
        })),
      };
    }),
    storage: {
      from: vi.fn((bucket: string) => {
        if (bucket !== "resumes") {
          throw new Error(`Unexpected bucket: ${bucket}`);
        }

        return {
          list: mockStorageList,
          getPublicUrl: mockGetPublicUrl,
        };
      }),
    },
  }));

  return {
    mockGetCurrentUser,
    mockCreateClient,
    mockRecordsOrder,
    mockStorageList,
    mockGetPublicUrl,
  };
});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { getResumeLibrary } from "./get-resume-library";

describe("getResumeLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    mockRecordsOrder.mockResolvedValue({
      data: [],
      error: null,
    });
    mockStorageList.mockResolvedValue({
      data: [],
      error: null,
    });
    mockGetPublicUrl.mockImplementation((filePath: string) => ({
      data: {
        publicUrl: `https://cdn.example.com/${filePath}`,
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("merges database records with storage files so legacy files stay visible", async () => {
    mockRecordsOrder.mockResolvedValue({
      data: [
        {
          id: "resume-db-1",
          storage_path: "user-1/existing.pdf",
          file_url: "https://cdn.example.com/user-1/existing.pdf",
          file_name: "existing.pdf",
          uploaded_at: "2026-03-22T10:00:00.000Z",
        },
      ],
      error: null,
    });
    mockStorageList.mockResolvedValue({
      data: [
        {
          id: "storage-1",
          name: "legacy.pdf",
          created_at: "2026-03-23T10:00:00.000Z",
          metadata: { size: 1024 },
        },
        {
          id: "storage-2",
          name: "existing.pdf",
          created_at: "2026-03-22T10:00:00.000Z",
          metadata: { size: 2048 },
        },
      ],
      error: null,
    });

    const result = await getResumeLibrary();

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.filePath)).toEqual([
      "user-1/legacy.pdf",
      "user-1/existing.pdf",
    ]);
    expect(result[1]).toMatchObject({
      id: "resume-db-1",
      filePath: "user-1/existing.pdf",
      defaultName: "existing",
    });
  });

  it("falls back to database records when storage listing fails", async () => {
    mockRecordsOrder.mockResolvedValue({
      data: [
        {
          id: "resume-db-1",
          storage_path: "user-1/existing.pdf",
          file_url: "https://cdn.example.com/user-1/existing.pdf",
          file_name: "existing.pdf",
          uploaded_at: "2026-03-22T10:00:00.000Z",
        },
      ],
      error: null,
    });
    mockStorageList.mockResolvedValue({
      data: null,
      error: { message: "storage down" },
    });

    const result = await getResumeLibrary();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "resume-db-1",
      filePath: "user-1/existing.pdf",
    });
  });
});

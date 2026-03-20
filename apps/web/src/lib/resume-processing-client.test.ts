import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchLatestProfile,
  triggerResumeProcessing,
  waitForProcessedProfile,
} from "./resume-processing-client";

describe("resume-processing-client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should trigger background resume processing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn(),
    });
    vi.stubGlobal("fetch", fetchMock);

    await triggerResumeProcessing({ storagePath: "user-1/test.pdf" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/profile/process-resume",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      }),
    );
  });

  it("should load the latest profile", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: {
          updated_at: "2026-03-20T10:00:00.000Z",
          resume_url: "https://example.com/resume.pdf",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const profile = await fetchLatestProfile();

    expect(profile?.resume_url).toBe("https://example.com/resume.pdf");
  });

  it("should wait until profile updated_at changes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { updated_at: "2026-03-20T10:00:00.000Z" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            updated_at: "2026-03-20T10:00:02.000Z",
            skills: ["React"],
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const profile = await waitForProcessedProfile({
      baselineUpdatedAt: "2026-03-20T10:00:00.000Z",
      intervalMs: 1,
      timeoutMs: 50,
    });

    expect(profile?.skills).toEqual(["React"]);
  });
});

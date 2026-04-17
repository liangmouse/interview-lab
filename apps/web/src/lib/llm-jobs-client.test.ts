import { afterEach, describe, expect, it, vi } from "vitest";
import { getResumeReviewJob, listResumeReviewJobs } from "./llm-jobs-client";

describe("llm-jobs-client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads resume review history with no-store caching", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );

    await listResumeReviewJobs();

    expect(fetchMock).toHaveBeenCalledWith("/api/resume-review/jobs", {
      cache: "no-store",
    });
  });

  it("loads a resume review job with no-store caching", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "job-1",
            status: "queued",
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    await getResumeReviewJob("job-1");

    expect(fetchMock).toHaveBeenCalledWith("/api/resume-review/jobs/job-1", {
      cache: "no-store",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdminClient } = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock("./supabase-admin", () => ({
  getSupabaseAdminClient,
}));

import {
  claimNextJobRecommendationJob,
  completeJobRecommendationJob,
  createJobRecommendationJob,
  failJobRecommendationJob,
  getJobSourceSessionForUser,
  upsertJobRecommendationFeedback,
  upsertJobSourceSession,
} from "./job-recommendation-data";

describe("job-recommendation-data job source sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts session records and reads them with user/source isolation", async () => {
    const row = {
      id: "session-1",
      user_id: "user-1",
      source: "boss",
      credential: { cookie: "boss-cookie=1" },
      status: "connected",
      validation_error: null,
      last_validated_at: "2026-04-17T00:00:00.000Z",
      created_at: "2026-04-17T00:00:00.000Z",
      updated_at: "2026-04-17T00:00:00.000Z",
    };

    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
    const selectForUpsert = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select: selectForUpsert }));
    const eqSource = vi.fn(() => ({ maybeSingle }));
    const eqUser = vi.fn(() => ({ eq: eqSource }));
    const selectForGet = vi.fn(() => ({ eq: eqUser }));

    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce({ upsert })
        .mockReturnValueOnce({ select: selectForGet }),
    } as any;

    const saved = await upsertJobSourceSession(
      {
        userId: "user-1",
        source: "boss",
        credential: { cookie: "boss-cookie=1" },
        status: "connected",
        lastValidatedAt: "2026-04-17T00:00:00.000Z",
      },
      client,
    );
    const loaded = await getJobSourceSessionForUser("user-1", "boss", client);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        source: "boss",
        credential: { cookie: "boss-cookie=1" },
      }),
      { onConflict: "user_id,source" },
    );
    expect(eqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(eqSource).toHaveBeenCalledWith("source", "boss");
    expect(saved.credential.cookie).toBe("boss-cookie=1");
    expect(loaded).toEqual(
      expect.objectContaining({
        id: "session-1",
        userId: "user-1",
        source: "boss",
        status: "connected",
      }),
    );
  });
});

describe("job-recommendation-data jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates recommendation jobs in queued status", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "job-1",
        user_id: "user-1",
        status: "queued",
        input_payload: {
          mode: "auto",
          source: "boss",
        },
        result_payload: null,
        error_message: null,
        provider_id: null,
        model: null,
        attempt_count: 0,
        available_at: "2026-04-17T00:00:00.000Z",
        started_at: null,
        completed_at: null,
        created_at: "2026-04-17T00:00:00.000Z",
        updated_at: "2026-04-17T00:00:00.000Z",
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const client = {
      from: vi.fn(() => ({ insert })),
    } as any;

    const job = await createJobRecommendationJob(
      {
        userId: "user-1",
        payload: {
          mode: "auto",
          source: "boss",
        },
      },
      client,
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        status: "queued",
        attempt_count: 0,
      }),
    );
    expect(job.status).toBe("queued");
    expect(job.payload.mode).toBe("auto");
  });

  it("only claims queued recommendation jobs", async () => {
    const staleLt = vi.fn().mockResolvedValue({ error: null });
    const staleEq = vi.fn(() => ({ lt: staleLt }));
    const staleUpdate = vi.fn(() => ({ eq: staleEq }));

    const limit = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const order = vi.fn(() => ({ limit }));
    const lte = vi.fn(() => ({ order }));
    const inStatus = vi.fn(() => ({ lte }));
    const select = vi.fn(() => ({ in: inStatus }));

    getSupabaseAdminClient.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce({ update: staleUpdate })
        .mockReturnValueOnce({ select }),
    });

    await claimNextJobRecommendationJob();

    expect(inStatus).toHaveBeenCalledWith("status", ["queued"]);
  });

  it("marks completed recommendation jobs as succeeded with result payload", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));

    getSupabaseAdminClient.mockReturnValue({
      from: vi.fn(() => ({ update })),
    });

    await completeJobRecommendationJob({
      jobId: "job-1",
      providerId: "openai",
      model: "gpt-5.4",
      result: {
        id: "result-1",
        mode: "auto",
        source: "boss",
        createdAt: "2026-04-17T00:00:00.000Z",
        inferredQuery: {
          cities: ["上海"],
          role: "前端工程师",
          industries: [],
          companySizes: [],
          reasoning: ["来自画像"],
        },
        summary: "推荐完成",
        jobs: [],
      },
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "succeeded",
        provider_id: "openai",
        model: "gpt-5.4",
        error_message: null,
      }),
    );
    expect(eq).toHaveBeenCalledWith("id", "job-1");
  });

  it("requeues failed recommendation jobs with delayed retry", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { attempt_count: 0 },
      error: null,
    });
    const eqForLoad = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq: eqForLoad }));

    const eqForUpdate = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: eqForUpdate }));

    getSupabaseAdminClient.mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce({ select })
        .mockReturnValueOnce({ update }),
    });

    await failJobRecommendationJob({
      jobId: "job-1",
      errorMessage: "BOSS 请求过于频繁",
      providerId: "openai",
      model: "gpt-5.4",
      terminal: false,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "queued",
        attempt_count: 1,
        error_message: "BOSS 请求过于频繁",
        provider_id: "openai",
        model: "gpt-5.4",
      }),
    );
    expect(eqForUpdate).toHaveBeenCalledWith("id", "job-1");
  });
});

describe("job-recommendation-data feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts feedback with the unique user/source/job key", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "feedback-1",
        user_id: "user-1",
        source: "boss",
        source_job_id: "boss-job-1",
        action: "hidden",
        job_snapshot: {
          sourceJobId: "boss-job-1",
          title: "前端工程师",
          companyName: "某科技",
          tags: [],
          matchScore: 82,
          matchReasons: ["技能匹配"],
          cautions: [],
        },
        created_at: "2026-04-17T00:00:00.000Z",
        updated_at: "2026-04-17T00:00:00.000Z",
      },
      error: null,
    });
    const select = vi.fn(() => ({ single }));
    const upsert = vi.fn(() => ({ select }));
    const client = {
      from: vi.fn(() => ({ upsert })),
    } as any;

    const feedback = await upsertJobRecommendationFeedback(
      {
        userId: "user-1",
        source: "boss",
        sourceJobId: "boss-job-1",
        action: "hidden",
        jobSnapshot: {
          sourceJobId: "boss-job-1",
          title: "前端工程师",
          companyName: "某科技",
          tags: [],
          matchScore: 82,
          matchReasons: ["技能匹配"],
          cautions: [],
        },
      },
      client,
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        source: "boss",
        source_job_id: "boss-job-1",
        action: "hidden",
      }),
      { onConflict: "user_id,source,source_job_id" },
    );
    expect(feedback.action).toBe("hidden");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetCurrentUser,
  mockCreateClient,
  mockDeleteJobSourceSessionForUser,
  mockGetJobSourceSessionForUser,
  mockUpsertJobSourceSession,
  mockValidateBossSession,
  BossRateLimitError,
  BossSessionInvalidError,
  BossUpstreamError,
} = vi.hoisted(() => {
  class RateLimitError extends Error {
    constructor(message = "BOSS 请求过于频繁，请稍后重试") {
      super(message);
      this.name = "BossRateLimitError";
    }
  }

  class SessionInvalidError extends Error {
    constructor(message = "BOSS 登录态失效，请重新导入 Cookie") {
      super(message);
      this.name = "BossSessionInvalidError";
    }
  }

  class UpstreamError extends Error {
    constructor(message = "BOSS 职位服务暂时不可用") {
      super(message);
      this.name = "BossUpstreamError";
    }
  }

  return {
    mockGetCurrentUser: vi.fn(),
    mockCreateClient: vi.fn(),
    mockDeleteJobSourceSessionForUser: vi.fn(),
    mockGetJobSourceSessionForUser: vi.fn(),
    mockUpsertJobSourceSession: vi.fn(),
    mockValidateBossSession: vi.fn(),
    BossRateLimitError: RateLimitError,
    BossSessionInvalidError: SessionInvalidError,
    BossUpstreamError: UpstreamError,
  };
});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@interviewclaw/data-access", () => ({
  deleteJobSourceSessionForUser: mockDeleteJobSourceSessionForUser,
  getJobSourceSessionForUser: mockGetJobSourceSessionForUser,
  upsertJobSourceSession: mockUpsertJobSourceSession,
}));

vi.mock("@interviewclaw/llm-apps", () => ({
  BossRateLimitError,
  BossSessionInvalidError,
  BossUpstreamError,
  validateBossSession: mockValidateBossSession,
}));

import { DELETE, GET, POST } from "./route";

describe("Boss Session API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: "user-1" });
    mockCreateClient.mockResolvedValue({});
    mockGetJobSourceSessionForUser.mockResolvedValue(null);
    mockUpsertJobSourceSession.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      source: "boss",
      status: "connected",
      lastValidatedAt: "2026-04-17T00:00:00.000Z",
    });
    mockValidateBossSession.mockResolvedValue({
      status: "connected",
      lastValidatedAt: "2026-04-17T00:00:00.000Z",
    });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("未登录或登录已过期");
  });

  it("stores a connected boss session after validation succeeds", async () => {
    const request = new Request(
      "http://localhost/api/job-sources/boss/session",
      {
        method: "POST",
        body: JSON.stringify({
          cookie: "boss-cookie=1",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockValidateBossSession).toHaveBeenCalledWith({
      credential: {
        cookie: "boss-cookie=1",
      },
    });
    expect(mockUpsertJobSourceSession).toHaveBeenCalledWith(
      {
        userId: "user-1",
        source: "boss",
        credential: {
          cookie: "boss-cookie=1",
        },
        status: "connected",
        validationError: undefined,
        lastValidatedAt: "2026-04-17T00:00:00.000Z",
      },
      expect.any(Object),
    );
    expect(data.data.status).toBe("connected");
  });

  it("stores invalid sessions when cookie validation fails", async () => {
    mockValidateBossSession.mockRejectedValueOnce(
      new BossSessionInvalidError("BOSS Cookie 已失效"),
    );
    mockUpsertJobSourceSession.mockResolvedValueOnce({
      id: "session-1",
      userId: "user-1",
      source: "boss",
      status: "invalid",
      validationError: "BOSS Cookie 已失效",
      lastValidatedAt: "2026-04-17T00:00:00.000Z",
    });

    const request = new Request(
      "http://localhost/api/job-sources/boss/session",
      {
        method: "POST",
        body: JSON.stringify({
          cookie: "boss-cookie=1",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(mockUpsertJobSourceSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        source: "boss",
        status: "invalid",
        validationError: "BOSS Cookie 已失效",
      }),
      expect.any(Object),
    );
    expect(data.error).toBe("BOSS Cookie 已失效");
  });

  it("deletes the stored boss session", async () => {
    const response = await DELETE();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockDeleteJobSourceSessionForUser).toHaveBeenCalledWith(
      "user-1",
      "boss",
      expect.any(Object),
    );
    expect(data.success).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockRequireOwnedInterview } = vi.hoisted(() => ({
  mockRequireOwnedInterview: vi.fn(),
}));

vi.mock("@/lib/interview-rag-service", () => ({
  requireOwnedInterview: mockRequireOwnedInterview,
}));

const { mockCreateStepfunRelaySession } = vi.hoisted(() => ({
  mockCreateStepfunRelaySession: vi.fn(),
}));

vi.mock("@/lib/stepfun-realtime-relay", () => ({
  createStepfunRelaySession: mockCreateStepfunRelaySession,
  closeStepfunRelaySession: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/interview/realtime/session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STEPFUN_REALTIME_API_KEY = "test-api-key";
    process.env.STEPFUN_REALTIME_MODEL = "test-model";
    mockRequireOwnedInterview.mockResolvedValue({
      userId: "user-1",
      profileId: "profile-1",
      profile: {},
      interview: {},
    });
    mockCreateStepfunRelaySession.mockResolvedValue({
      sessionId: "relay-session-1",
      expiresAt: "2026-04-14T00:00:00.000Z",
    });
  });

  it("returns 400 when interviewId is missing", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/interview/realtime/session", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("缺少 interviewId");
  });

  it("returns 500 when realtime env is missing", async () => {
    delete process.env.STEPFUN_REALTIME_API_KEY;

    const response = await POST(
      new NextRequest("http://localhost/api/interview/realtime/session", {
        method: "POST",
        body: JSON.stringify({ interviewId: "interview-1" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("STEPFUN_REALTIME_API_KEY");
  });

  it("returns the expected session config on success", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/interview/realtime/session", {
        method: "POST",
        body: JSON.stringify({ interviewId: "interview-1" }),
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.voiceKernel).toBe("stepfun-realtime");
    expect(data.sessionConfig.model).toBe("test-model");
    expect(data.sessionConfig.transport).toBe("server-relay");
    expect(data.sessionConfig.sessionId).toBe("relay-session-1");
    expect(data.sessionConfig.inputUrl).toContain("relay-session-1");
  });
});

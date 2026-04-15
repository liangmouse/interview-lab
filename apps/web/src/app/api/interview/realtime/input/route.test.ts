import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockEnsureStepfunRelaySession, mockSendStepfunRelayEvent } = vi.hoisted(
  () => ({
    mockEnsureStepfunRelaySession: vi.fn(),
    mockSendStepfunRelayEvent: vi.fn(),
  }),
);

vi.mock("@/lib/stepfun-realtime-relay", () => ({
  ensureStepfunRelaySession: mockEnsureStepfunRelaySession,
  sendStepfunRelayEvent: mockSendStepfunRelayEvent,
}));

import { POST } from "./route";

describe("POST /api/interview/realtime/input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when sessionId is missing", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/interview/realtime/input", {
        method: "POST",
        body: JSON.stringify({ events: [] }),
        headers: { "Content-Type": "application/json" },
      }),
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("缺少 sessionId");
  });

  it("forwards batched json events to relay", async () => {
    const response = await POST(
      new NextRequest(
        "http://localhost/api/interview/realtime/input?sessionId=session-1",
        {
          method: "POST",
          body: JSON.stringify({
            events: [
              { type: "session.update", session: { voice: "test" } },
              { type: "response.create", response: { modalities: ["audio"] } },
            ],
          }),
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockEnsureStepfunRelaySession).toHaveBeenCalledWith("session-1");
    expect(mockSendStepfunRelayEvent).toHaveBeenNthCalledWith(1, "session-1", {
      type: "session.update",
      session: { voice: "test" },
    });
    expect(mockSendStepfunRelayEvent).toHaveBeenNthCalledWith(2, "session-1", {
      type: "response.create",
      response: { modalities: ["audio"] },
    });
  });
});

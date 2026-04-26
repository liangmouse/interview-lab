import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("GET /api/voice/realtime/session", () => {
  beforeEach(() => {
    vi.stubEnv("VOLC_REALTIME_BROWSER_API_KEY", "browser-token");
    vi.stubEnv("VOLCENGINE_STT_APP_ID", "volc-app-id");
    vi.stubEnv("VOLCENGINE_STT_ACCESS_TOKEN", "volc-access-token");
    vi.stubEnv("GATEWAY_PORT", "9876");
    vi.stubEnv("VOICE_GATEWAY_WS_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 503 with missing env names when realtime config is incomplete", async () => {
    vi.stubEnv("VOLCENGINE_STT_ACCESS_TOKEN", "");

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toContain("实时语音配置缺失");
    expect(data.missingEnv).toEqual(["VOLCENGINE_STT_ACCESS_TOKEN"]);
  });

  it("returns the browser token and default gateway url", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      token: "browser-token",
      gatewayUrl: "ws://localhost:9876/voice/realtime",
    });
  });

  it("prefers an explicit gateway websocket url", async () => {
    vi.stubEnv(
      "VOICE_GATEWAY_WS_URL",
      "wss://gateway.example.com/voice/realtime",
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.gatewayUrl).toBe("wss://gateway.example.com/voice/realtime");
  });
});

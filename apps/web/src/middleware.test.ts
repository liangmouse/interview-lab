import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpdateSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: mockUpdateSession,
}));

vi.mock("next-intl/middleware", () => ({
  default: () => vi.fn(() => NextResponse.next()),
}));

import { middleware } from "./middleware";

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateSession.mockResolvedValue(NextResponse.next());
  });

  it("preserves query params when rewriting default-locale auth callback", async () => {
    const request = new NextRequest(
      "https://app.lmgbc.com/auth/callback?code=oauth-code&state=oauth-state",
    );

    const response = await middleware(request);

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://app.lmgbc.com/zh/auth/callback?code=oauth-code&state=oauth-state",
    );
  });
});

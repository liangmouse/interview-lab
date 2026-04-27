import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateServerClient,
  mockExchangeCodeForSession,
  mockGetOrCreateUserProfile,
  mockGetRequiredSupabasePublicEnv,
} = vi.hoisted(() => ({
  mockCreateServerClient: vi.fn(),
  mockExchangeCodeForSession: vi.fn(),
  mockGetOrCreateUserProfile: vi.fn(),
  mockGetRequiredSupabasePublicEnv: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock("@/action/user-profile", () => ({
  getOrCreateUserProfile: mockGetOrCreateUserProfile,
}));

vi.mock("@/lib/supabase/env", () => ({
  getRequiredSupabasePublicEnv: mockGetRequiredSupabasePublicEnv,
}));

import { GET } from "./route";

describe("OAuth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequiredSupabasePublicEnv.mockReturnValue({
      url: "https://example.supabase.co",
      key: "anon-key",
    });
    mockExchangeCodeForSession.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    mockGetOrCreateUserProfile.mockResolvedValue({ id: "profile-1" });
    mockCreateServerClient.mockImplementation((_url, _key, options) => ({
      auth: {
        exchangeCodeForSession: async (code: string) => {
          options.cookies.setAll([
            {
              name: "sb-example-auth-token",
              value: "session-value",
              options: { path: "/" },
            },
          ]);
          return mockExchangeCodeForSession(code);
        },
      },
    }));
  });

  it("exchanges code, writes auth cookies, and redirects to dashboard", async () => {
    const request = new Request(
      "https://app.lmgbc.com/auth/callback?code=oauth-code",
      {
        headers: {
          Cookie: "sb-example-auth-token-code-verifier=verifier",
        },
      },
    );

    const response = await GET(request as any);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.lmgbc.com/dashboard",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "sb-example-auth-token=session-value",
    );
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(mockGetOrCreateUserProfile).toHaveBeenCalledWith({ id: "user-1" });
  });

  it("redirects back to sign-in when code is missing", async () => {
    const response = await GET(
      new Request("https://app.lmgbc.com/auth/callback") as any,
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "https://app.lmgbc.com/auth/sign-in?error=",
    );
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });
});

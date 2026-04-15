import { describe, expect, it } from "vitest";
import { getLocalizedAppPath, getOAuthRedirectTo } from "./auth-redirect";

describe("auth redirect helpers", () => {
  it("uses default locale callback path without prefix", () => {
    expect(getOAuthRedirectTo("/auth/sign-in", "http://localhost:3000")).toBe(
      "http://localhost:3000/auth/callback",
    );
  });

  it("preserves non-default locale in callback path", () => {
    expect(
      getOAuthRedirectTo("/en/auth/sign-in", "http://localhost:3000"),
    ).toBe("http://localhost:3000/en/auth/callback");
  });

  it("preserves non-default locale for app redirects", () => {
    expect(getLocalizedAppPath("/en/auth/callback", "/dashboard")).toBe(
      "/en/dashboard",
    );
  });

  it("keeps default locale redirects unprefixed", () => {
    expect(getLocalizedAppPath("/auth/callback", "/dashboard")).toBe(
      "/dashboard",
    );
  });
});

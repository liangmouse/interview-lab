import { describe, expect, it, vi } from "vitest";
import {
  createOpenAICodexAuthProvider,
  type OpenAICodexAuthProviderDeps,
} from "./provider";
import { createAuthProfileStore } from "../../storage/auth-profiles";

describe("auth/openai-codex provider", () => {
  function createDeps(
    overrides: Partial<OpenAICodexAuthProviderDeps> = {},
  ): OpenAICodexAuthProviderDeps {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/oauth/token")) {
        return new Response(
          JSON.stringify({
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 3600,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url.includes("/oauth/userinfo")) {
        return new Response(
          JSON.stringify({
            email: "user@example.com",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    return {
      env: {},
      profileStore: createAuthProfileStore({ initialRecords: [] }),
      fetch,
      now: () => 1_000,
      randomBytes: (size) => Buffer.alloc(size, 7),
      openBrowser: vi.fn(async () => true),
      waitForRedirectUrl: vi.fn(async (url) => {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}?code=auth-code&state=${parsed.searchParams.get("state")}`;
      }),
      promptForRedirectUrl: vi.fn(async () => {
        throw new Error("promptForRedirectUrl should not be called");
      }),
      ...overrides,
    };
  }

  it("completes local login, opens the browser, and persists the profile", async () => {
    const deps = createDeps();
    const provider = createOpenAICodexAuthProvider(deps);

    const result = await provider.startLogin();

    expect(deps.openBrowser).toHaveBeenCalledTimes(1);
    expect(result.profileId).toBe("openai-codex:user@example.com");
    await expect(provider.loadCredential(result.profileId)).resolves.toEqual({
      access: "access-token",
      refresh: "refresh-token",
      email: "user@example.com",
      expires: 3_601_000,
    });
  });

  it("supports remote login by prompting for the pasted redirect url", async () => {
    const deps = createDeps({
      waitForRedirectUrl: vi.fn(async () => {
        throw new Error("waitForRedirectUrl should not be called");
      }),
      promptForRedirectUrl: vi.fn(async (url) => {
        const parsed = new URL(url);
        return `${parsed.searchParams.get("redirect_uri")}?code=remote-code&state=${parsed.searchParams.get("state")}`;
      }),
    });
    const provider = createOpenAICodexAuthProvider(deps);

    const result = await provider.startLogin({ remote: true });

    expect(deps.promptForRedirectUrl).toHaveBeenCalledTimes(1);
    expect(result.credential.email).toBe("user@example.com");
  });

  it("fails when the callback state does not match", async () => {
    const deps = createDeps({
      waitForRedirectUrl: vi.fn(async (url) => {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}?code=auth-code&state=wrong-state`;
      }),
    });
    const provider = createOpenAICodexAuthProvider(deps);

    await expect(provider.startLogin()).rejects.toThrow("Invalid OAuth state");
  });

  it("fails when token exchange does not return an access token", async () => {
    const deps = createDeps({
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/oauth/token")) {
          return new Response(
            JSON.stringify({ refresh_token: "refresh-token" }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        return new Response(JSON.stringify({ email: "user@example.com" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    });
    const provider = createOpenAICodexAuthProvider(deps);

    await expect(provider.startLogin()).rejects.toThrow(
      "OpenAI Codex OAuth token response is missing access_token",
    );
  });

  it("fails without a resolvable email and does not persist a profile", async () => {
    const deps = createDeps({
      fetch: vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/oauth/token")) {
          return new Response(
            JSON.stringify({
              access_token: "access-token",
              refresh_token: "refresh-token",
              expires_in: 3600,
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }

        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    });
    const provider = createOpenAICodexAuthProvider(deps);

    await expect(provider.startLogin()).rejects.toThrow(
      "OpenAI Codex OAuth could not determine the account email",
    );
    await expect(
      deps.profileStore.getProfilesByProvider("openai-codex"),
    ).resolves.toEqual([]);
  });

  it("refreshes an existing credential and persists the new token", async () => {
    const deps = createDeps();
    const provider = createOpenAICodexAuthProvider(deps);
    const profileId = "openai-codex:user@example.com";
    await provider.saveCredential(profileId, {
      access: "old-access",
      refresh: "refresh-token",
      email: "user@example.com",
      expires: 500,
    });

    const refreshed = await provider.refreshCredential(profileId, {
      access: "old-access",
      refresh: "refresh-token",
      email: "user@example.com",
      expires: 500,
    });

    expect(refreshed.access).toBe("access-token");
    await expect(provider.loadCredential(profileId)).resolves.toEqual(
      refreshed,
    );
  });

  it("fails refresh when no refresh token is available", async () => {
    const provider = createOpenAICodexAuthProvider(createDeps());

    await expect(
      provider.refreshCredential("openai-codex:user@example.com", {
        access: "access-token",
        email: "user@example.com",
      }),
    ).rejects.toThrow(
      "OpenAI Codex OAuth credential has no refresh token; please login again",
    );
  });
});

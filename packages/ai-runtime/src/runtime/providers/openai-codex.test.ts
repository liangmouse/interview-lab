import { describe, expect, it, vi } from "vitest";
import { createOpenAICodexProvider } from "./openai-codex";
import { createAuthProfileStore } from "../../storage/auth-profiles";
import type { AuthProvider } from "../../auth/provider";

describe("runtime/providers/openai-codex", () => {
  it("refreshes once and retries when the upstream returns 401", async () => {
    const profileStore = createAuthProfileStore({
      initialRecords: [
        {
          id: "openai-codex:user@example.com",
          provider: "openai-codex",
          updatedAt: 1,
          credential: {
            access: "expired-access-token",
            refresh: "refresh-token",
            email: "user@example.com",
            expires: Date.now() + 120_000,
          },
        },
      ],
    });
    const authProvider = {
      startLogin: vi.fn(),
      loadCredential: vi.fn(),
      saveCredential: vi.fn(),
      refreshCredential: vi.fn(async () => ({
        access: "refreshed-access-token",
        refresh: "refresh-token",
        email: "user@example.com",
        expires: Date.now() + 60_000,
      })),
    } satisfies AuthProvider;
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const provider = createOpenAICodexProvider({
      profile: {
        id: "openai-codex:user@example.com",
        provider: "openai-codex",
        updatedAt: 1,
        credential: {
          access: "expired-access-token",
          refresh: "refresh-token",
          email: "user@example.com",
          expires: Date.now() + 120_000,
        },
      },
      authProvider,
      profileStore,
      fetch,
    });

    const response = await provider.createClientFetch()(
      "https://chatgpt.com/backend-api/codex/responses",
      { method: "POST" },
    );

    expect(response.status).toBe(200);
    expect(authProvider.refreshCredential).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

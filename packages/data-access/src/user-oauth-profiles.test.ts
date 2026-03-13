import { describe, expect, it, vi } from "vitest";
import { createUserScopedSupabaseAuthProfileStore } from "./user-oauth-profiles";

describe("createUserScopedSupabaseAuthProfileStore", () => {
  it("reads and writes only the current user's openai-codex credential", async () => {
    const single = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          profile_id: "openai-codex:user-1",
          provider: "openai-codex",
          credential: {
            access: "access-token",
            refresh: "refresh-token",
            email: "user@example.com",
          },
          updated_at: "2026-03-12T10:00:00.000Z",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          profile_id: "openai-codex:user-1",
          provider: "openai-codex",
          credential: {
            access: "new-access-token",
            email: "user@example.com",
          },
          updated_at: "2026-03-12T12:00:00.000Z",
        },
        error: null,
      });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: [
        {
          profile_id: "openai-codex:user-1",
          provider: "openai-codex",
          credential: {
            access: "access-token",
            email: "user@example.com",
          },
          updated_at: "2026-03-12T10:00:00.000Z",
        },
      ],
      error: null,
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const deleteProviderEq = vi.fn().mockResolvedValue({ error: null });
    const deleteProfileEq = vi.fn(() => ({ eq: deleteProviderEq }));
    const deleteUserEq = vi.fn(() => ({ eq: deleteProfileEq }));
    const getProfileEqUser = vi.fn((field: string) => {
      expect(field).toBe("profile_id");
      return { single };
    });
    const getProfilesEqUser = vi.fn((field: string) => {
      expect(field).toBe("provider");
      return { maybeSingle };
    });
    const select = vi
      .fn()
      .mockReturnValueOnce({
        eq: vi.fn((field: string) => {
          expect(field).toBe("user_id");
          return { eq: getProfileEqUser };
        }),
      })
      .mockReturnValueOnce({
        eq: vi.fn((field: string) => {
          expect(field).toBe("user_id");
          return { eq: getProfilesEqUser };
        }),
      });
    const from = vi.fn((table: string) => {
      expect(table).toBe("user_oauth_credentials");
      return {
        select,
        upsert,
        delete: vi.fn(() => ({
          eq: deleteUserEq,
        })),
      };
    });

    const store = createUserScopedSupabaseAuthProfileStore({
      userId: "user-1",
      supabase: { from } as any,
    });

    await expect(store.getProfile("openai-codex:user-1")).resolves.toEqual({
      id: "openai-codex:user-1",
      provider: "openai-codex",
      credential: {
        access: "access-token",
        refresh: "refresh-token",
        email: "user@example.com",
      },
      updatedAt: Date.parse("2026-03-12T10:00:00.000Z"),
    });

    await store.upsertProfile({
      id: "openai-codex:user-1",
      provider: "openai-codex",
      credential: {
        access: "new-access-token",
        email: "user@example.com",
      },
      updatedAt: Date.parse("2026-03-12T12:00:00.000Z"),
    });

    await expect(store.getProfilesByProvider("openai-codex")).resolves.toEqual([
      {
        id: "openai-codex:user-1",
        provider: "openai-codex",
        credential: {
          access: "access-token",
          email: "user@example.com",
        },
        updatedAt: Date.parse("2026-03-12T10:00:00.000Z"),
      },
    ]);

    await store.deleteProfile("openai-codex:user-1");

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        profile_id: "openai-codex:user-1",
        provider: "openai-codex",
      }),
      {
        onConflict: "user_id,provider",
      },
    );
    expect(getProfileEqUser).toHaveBeenCalledWith(
      "profile_id",
      "openai-codex:user-1",
    );
    expect(getProfilesEqUser).toHaveBeenCalledWith("provider", "openai-codex");
    expect(deleteUserEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(deleteProfileEq).toHaveBeenCalledWith(
      "profile_id",
      "openai-codex:user-1",
    );
    expect(deleteProviderEq).toHaveBeenCalledWith("provider", "openai-codex");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createAuthProfileStore,
  type AuthProfileRecord,
} from "./auth-profiles";

describe("storage/auth-profiles", () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  async function createStore() {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "ai-runtime-auth-"));
    return createAuthProfileStore({
      filePath: path.join(tempDir, "auth-profiles.json"),
    });
  }

  function makeRecord(
    overrides: Partial<AuthProfileRecord> = {},
  ): AuthProfileRecord {
    return {
      id: "openai-codex:user@example.com",
      provider: "openai-codex",
      updatedAt: 100,
      credential: {
        access: "access-token",
        refresh: "refresh-token",
        email: "user@example.com",
        expires: Date.now() + 60_000,
      },
      ...overrides,
    };
  }

  it("creates the storage file on first upsert and returns the saved profile", async () => {
    const store = await createStore();
    const record = makeRecord();

    await store.upsertProfile(record);

    await expect(store.getProfile(record.id)).resolves.toEqual(record);
  });

  it("returns provider profiles ordered by latest updatedAt first", async () => {
    const store = await createStore();
    const older = makeRecord({
      id: "openai-codex:older@example.com",
      updatedAt: 10,
    });
    const newer = makeRecord({
      id: "openai-codex:newer@example.com",
      updatedAt: 20,
    });

    await store.upsertProfile(older);
    await store.upsertProfile(newer);

    await expect(store.getProfilesByProvider("openai-codex")).resolves.toEqual([
      newer,
      older,
    ]);
  });

  it("updates only provided fields when patching a profile", async () => {
    const store = await createStore();
    const record = makeRecord();
    await store.upsertProfile(record);

    await store.updateProfile(record.id, {
      credential: {
        ...record.credential,
        access: "new-access-token",
      },
      updatedAt: 200,
    });

    await expect(store.getProfile(record.id)).resolves.toEqual({
      ...record,
      updatedAt: 200,
      credential: {
        ...record.credential,
        access: "new-access-token",
      },
    });
  });

  it("marks credentials expiring within the safety window as expired", async () => {
    const store = await createStore();
    const record = makeRecord({
      credential: {
        access: "access-token",
        expires: 10_050,
      },
    });

    expect(store.isCredentialExpired(record, 10_000)).toBe(true);
    expect(
      store.isCredentialExpired(
        makeRecord({
          credential: {
            access: "access-token",
            expires: 80_200,
          },
        }),
        10_000,
      ),
    ).toBe(false);
  });
});

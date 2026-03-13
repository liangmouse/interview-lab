import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { OAuthCredential } from "../auth/provider";

export type AuthProviderId = "openai-codex";

export type AuthProfileRecord = {
  id: string;
  provider: AuthProviderId;
  credential: OAuthCredential;
  updatedAt: number;
};

type AuthProfilesFile = {
  version: 1;
  profiles: Record<string, AuthProfileRecord>;
};

export interface AuthProfileStore {
  getProfile(id: string): Promise<AuthProfileRecord | null>;
  getProfilesByProvider(
    providerId: AuthProviderId,
  ): Promise<AuthProfileRecord[]>;
  upsertProfile(record: AuthProfileRecord): Promise<void>;
  deleteProfile(id: string): Promise<void>;
  updateProfile(
    id: string,
    patch: Partial<Pick<AuthProfileRecord, "credential" | "updatedAt">>,
  ): Promise<void>;
  isCredentialExpired(record: AuthProfileRecord, now?: number): boolean;
}

type CreateAuthProfileStoreOptions = {
  filePath?: string;
  initialRecords?: AuthProfileRecord[];
};

const PROFILE_EXPIRY_SAFETY_WINDOW_MS = 60_000;

function getDefaultProfilesFilePath(): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA?.trim();
    if (!appData) {
      throw new Error("APPDATA is required to resolve the auth profiles path");
    }
    return path.join(appData, "interviewclaw", "auth-profiles.json");
  }

  const configHome =
    process.env.XDG_CONFIG_HOME?.trim() || path.join(os.homedir(), ".config");
  return path.join(configHome, "interviewclaw", "auth-profiles.json");
}

function cloneRecord(record: AuthProfileRecord): AuthProfileRecord {
  return {
    ...record,
    credential: { ...record.credential },
  };
}

export function createAuthProfileStore(
  options: CreateAuthProfileStoreOptions = {},
): AuthProfileStore {
  if (options.initialRecords) {
    const inMemoryProfiles = new Map<string, AuthProfileRecord>(
      options.initialRecords.map((record) => [record.id, cloneRecord(record)]),
    );

    return createStoreApi({
      loadProfiles: async () => new Map(inMemoryProfiles),
      persistProfiles: async (profiles) => {
        inMemoryProfiles.clear();
        for (const [id, record] of profiles.entries()) {
          inMemoryProfiles.set(id, cloneRecord(record));
        }
      },
    });
  }

  const filePath = options.filePath || getDefaultProfilesFilePath();

  return createStoreApi({
    loadProfiles: async () => readProfilesFile(filePath),
    persistProfiles: async (profiles) => writeProfilesFile(filePath, profiles),
  });
}

function createStoreApi(io: {
  loadProfiles: () => Promise<Map<string, AuthProfileRecord>>;
  persistProfiles: (profiles: Map<string, AuthProfileRecord>) => Promise<void>;
}): AuthProfileStore {
  return {
    async getProfile(id) {
      const profiles = await io.loadProfiles();
      return cloneNullableRecord(profiles.get(id) ?? null);
    },

    async getProfilesByProvider(providerId) {
      const profiles = await io.loadProfiles();
      return Array.from(profiles.values())
        .filter((record) => record.provider === providerId)
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .map(cloneRecord);
    },

    async upsertProfile(record) {
      const profiles = await io.loadProfiles();
      profiles.set(record.id, cloneRecord(record));
      await io.persistProfiles(profiles);
    },

    async deleteProfile(id) {
      const profiles = await io.loadProfiles();
      profiles.delete(id);
      await io.persistProfiles(profiles);
    },

    async updateProfile(id, patch) {
      const profiles = await io.loadProfiles();
      const current = profiles.get(id);
      if (!current) {
        throw new Error(`Auth profile not found: ${id}`);
      }

      profiles.set(id, {
        ...current,
        ...(patch.updatedAt !== undefined
          ? { updatedAt: patch.updatedAt }
          : {}),
        ...(patch.credential ? { credential: { ...patch.credential } } : {}),
      });
      await io.persistProfiles(profiles);
    },

    isCredentialExpired(record, now = Date.now()) {
      if (!record.credential.expires) {
        return false;
      }
      return record.credential.expires <= now + PROFILE_EXPIRY_SAFETY_WINDOW_MS;
    },
  };
}

async function readProfilesFile(
  filePath: string,
): Promise<Map<string, AuthProfileRecord>> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as Partial<AuthProfilesFile>;
    const profiles = parsed.profiles ?? {};
    return new Map(
      Object.entries(profiles).map(([id, record]) => [
        id,
        cloneRecord(record as AuthProfileRecord),
      ]),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Map();
    }
    throw error;
  }
}

async function writeProfilesFile(
  filePath: string,
  profiles: Map<string, AuthProfileRecord>,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const payload: AuthProfilesFile = {
    version: 1,
    profiles: Object.fromEntries(
      Array.from(profiles.entries()).map(([id, record]) => [
        id,
        cloneRecord(record),
      ]),
    ),
  };
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, {
    mode: 0o600,
  });
  if (process.platform !== "win32") {
    await chmod(tempPath, 0o600);
  }
  await rename(tempPath, filePath);
  if (process.platform !== "win32") {
    await chmod(filePath, 0o600);
  }
}

function cloneNullableRecord(
  record: AuthProfileRecord | null,
): AuthProfileRecord | null {
  return record ? cloneRecord(record) : null;
}

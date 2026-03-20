import type { UserProfile } from "@/types/profile";

interface TriggerResumeProcessingInput {
  storagePath: string;
}

interface WaitForProcessedProfileInput {
  baselineUpdatedAt?: string | null;
  timeoutMs?: number;
  intervalMs?: number;
}

export function triggerResumeProcessing({
  storagePath,
}: TriggerResumeProcessingInput): Promise<void> {
  return fetch("/api/profile/process-resume", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ storagePath }),
    keepalive: true,
  }).then(async (response) => {
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || "后台解析启动失败");
    }
  });
}

export async function fetchLatestProfile(): Promise<UserProfile | null> {
  const response = await fetch("/api/profile", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("获取最新用户资料失败");
  }

  const payload = (await response.json()) as { data?: UserProfile | null };
  return payload.data ?? null;
}

export async function waitForProcessedProfile({
  baselineUpdatedAt,
  timeoutMs = 45_000,
  intervalMs = 2_000,
}: WaitForProcessedProfileInput): Promise<UserProfile | null> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const profile = await fetchLatestProfile();
    if (profile?.updated_at && profile.updated_at !== baselineUpdatedAt) {
      return profile;
    }

    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, intervalMs);
    });
  }

  return null;
}

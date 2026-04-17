import type {
  JobRecommendationFeedback,
  JobRecommendationFeedbackAction,
  JobRecommendationJob,
  JobSearchPreferences,
  JobSourceSession,
  JobSourceSessionStatus,
  RecommendedJob,
} from "@interviewclaw/domain";

async function fetchJson(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "请求失败");
  }
  return payload;
}

export async function listJobRecommendationJobs() {
  const payload = await fetchJson("/api/job-recommendations/jobs", {
    cache: "no-store",
  });
  return payload.data as JobRecommendationJob[];
}

export async function getJobRecommendationJob(jobId: string) {
  const payload = await fetchJson(`/api/job-recommendations/jobs/${jobId}`, {
    cache: "no-store",
  });
  return payload.data as JobRecommendationJob;
}

export async function createAutoJobRecommendation() {
  const payload = await fetchJson("/api/job-recommendations/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "auto",
    }),
  });
  return payload.data as JobRecommendationJob;
}

export async function createManualJobRecommendation(input: {
  filters: JobSearchPreferences;
  savePreferences?: boolean;
}) {
  const payload = await fetchJson("/api/job-recommendations/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "manual",
      manualFilters: input.filters,
      savePreferences: input.savePreferences ?? false,
    }),
  });
  return payload.data as JobRecommendationJob;
}

export async function upsertJobRecommendationFeedback(input: {
  sourceJobId: string;
  action: JobRecommendationFeedbackAction;
  jobSnapshot: RecommendedJob;
}) {
  const payload = await fetchJson("/api/job-recommendations/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return payload.data as JobRecommendationFeedback;
}

export type BossSessionView = JobSourceSession & {
  status: JobSourceSessionStatus;
};

export async function getBossSession() {
  const payload = await fetchJson("/api/job-sources/boss/session", {
    cache: "no-store",
  });
  return (payload.data ?? null) as BossSessionView | null;
}

export async function saveBossSession(cookie: string) {
  const payload = await fetchJson("/api/job-sources/boss/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cookie }),
  });
  return payload.data as BossSessionView;
}

export async function deleteBossSession() {
  await fetchJson("/api/job-sources/boss/session", {
    method: "DELETE",
  });
}

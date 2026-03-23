import type { QuestioningJob, ResumeReviewJob } from "@interviewclaw/domain";

async function fetchJsonWithTiming(
  label: string,
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const startedAt = performance.now();
  const response = await fetch(input, init);
  const durationMs = Math.round(performance.now() - startedAt);
  console.info(`[llm-jobs-client] ${label}`, {
    url: typeof input === "string" ? input : input.toString(),
    method: init?.method || "GET",
    status: response.status,
    ok: response.ok,
    durationMs,
  });
  return response;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "请求失败");
  }
  return payload as T;
}

export async function createResumeReviewJob(input: {
  resumeStoragePath: string;
  jobDescription?: string;
}) {
  const response = await fetchJsonWithTiming(
    "createResumeReviewJob",
    "/api/resume-review/jobs",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const payload = await readJson<{ data: ResumeReviewJob }>(response);
  return payload.data;
}

export async function getResumeReviewJob(jobId: string) {
  const response = await fetchJsonWithTiming(
    "getResumeReviewJob",
    `/api/resume-review/jobs/${jobId}`,
  );
  const payload = await readJson<{ data: ResumeReviewJob }>(response);
  return payload.data;
}

export async function listResumeReviewJobs() {
  const response = await fetchJsonWithTiming(
    "listResumeReviewJobs",
    "/api/resume-review/jobs",
  );
  const payload = await readJson<{ data: ResumeReviewJob[] }>(response);
  return payload.data;
}

export async function createQuestioningJob(input: {
  resumeId: string;
  targetRole: string;
  track: "social" | "campus";
  workExperience?: string;
  targetCompany?: string;
  jobDescription?: string;
}) {
  const response = await fetchJsonWithTiming(
    "createQuestioningJob",
    "/api/questioning/jobs",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );

  const payload = await readJson<{ data: QuestioningJob }>(response);
  return payload.data;
}

export async function getQuestioningJob(jobId: string) {
  const response = await fetchJsonWithTiming(
    "getQuestioningJob",
    `/api/questioning/jobs/${jobId}`,
  );
  const payload = await readJson<{ data: QuestioningJob }>(response);
  return payload.data;
}

export async function listQuestioningJobs() {
  const response = await fetchJsonWithTiming(
    "listQuestioningJobs",
    "/api/questioning/jobs",
  );
  const payload = await readJson<{ data: QuestioningJob[] }>(response);
  return payload.data;
}

import type {
  ResumeGenerationJob,
  ResumeGenerationLanguage,
  ResumeGenerationSession,
  ResumeGenerationDirectionPreset,
  ResumeVersion,
} from "@interviewclaw/domain";

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "请求失败");
  }
  return payload as T;
}

export function createResumeGenerationSession(input: {
  sourceResumeStoragePath: string;
  directionPreset: ResumeGenerationDirectionPreset;
  customStylePrompt?: string;
  language: ResumeGenerationLanguage;
}) {
  return fetchJson<{ data: ResumeGenerationSession }>(
    "/api/resume-generation/sessions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  ).then((payload) => payload.data);
}

export function submitResumeGenerationAnswer(input: {
  sessionId: string;
  answer: string;
}) {
  return fetchJson<{ data: ResumeGenerationSession }>(
    `/api/resume-generation/sessions/${input.sessionId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ answer: input.answer }),
    },
  ).then((payload) => payload.data);
}

export function createResumeGenerationJob(input: { sessionId: string }) {
  return fetchJson<{ data: ResumeGenerationJob }>(
    "/api/resume-generation/jobs",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  ).then((payload) => payload.data);
}

export function getResumeGenerationJob(jobId: string) {
  return fetchJson<{ data: ResumeGenerationJob }>(
    `/api/resume-generation/jobs/${jobId}`,
    {
      cache: "no-store",
    },
  ).then((payload) => payload.data);
}

export function listResumeGenerationJobs() {
  return fetchJson<{ data: ResumeGenerationJob[] }>(
    "/api/resume-generation/jobs",
    {
      cache: "no-store",
    },
  ).then((payload) => payload.data);
}

export function listResumeVersions() {
  return fetchJson<{ data: ResumeVersion[] }>(
    "/api/resume-generation/versions",
    {
      cache: "no-store",
    },
  ).then((payload) => payload.data);
}

import type {
  JobRecommendationFeedback,
  JobRecommendationFeedbackAction,
  JobRecommendationJob,
  JobRecommendationJobPayload,
  JobRecommendationResult,
  JobSearchPreferences,
  JobSource,
  JobSourceSession,
  JobSourceSessionCredential,
  JobSourceSessionRecord,
  JobSourceSessionStatus,
  LlmJobStatus,
  ResumeRecord,
  ResumeRecordStatus,
  RecommendedJob,
} from "@interviewclaw/domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase-admin";
import { sanitizeDatabaseValue } from "./llm-job-data";

type SupabaseQueryClient = Pick<SupabaseClient, "from">;

type ResumeRow = {
  id: string;
  user_id: string;
  file_url: string;
  parsed_text: string | null;
  uploaded_at: string | null;
  storage_path: string | null;
  file_name: string | null;
  parsed_json: Record<string, unknown> | null;
  processing_status: string | null;
  last_processed_at: string | null;
};

type JobRow<TPayload, TResult> = {
  id: string;
  user_id: string;
  status: LlmJobStatus;
  input_payload: TPayload;
  result_payload: TResult | null;
  error_message: string | null;
  provider_id: string | null;
  model: string | null;
  attempt_count: number | null;
  available_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type JobSourceSessionRow = {
  id: string;
  user_id: string;
  source: JobSource;
  credential: JobSourceSessionCredential;
  status: string | null;
  validation_error: string | null;
  last_validated_at: string | null;
  created_at: string;
  updated_at: string;
};

type JobRecommendationFeedbackRow = {
  id: string;
  user_id: string;
  source: JobSource;
  source_job_id: string;
  action: JobRecommendationFeedbackAction;
  job_snapshot: RecommendedJob;
  created_at: string;
  updated_at: string;
};

type UserProfileRow = {
  id: string;
  user_id: string;
  nickname: string | null;
  bio: string | null;
  job_intention: string | null;
  company_intention: string | null;
  experience_years: number | null;
  skills: string[] | null;
  work_experiences: Record<string, unknown>[] | null;
  project_experiences: Record<string, unknown>[] | null;
  job_search_preferences: Record<string, unknown> | null;
};

type UserProfileVectorRow = {
  content: string;
  metadata: Record<string, unknown> | null;
  updated_at: string | null;
};

const JOB_RETRY_DELAY_MINUTES = 5;

export type RecommendationUserProfile = {
  id: string;
  userId: string;
  nickname?: string;
  bio?: string;
  jobIntention?: string;
  companyIntention?: string;
  experienceYears?: number;
  skills: string[];
  workExperiences: Record<string, unknown>[];
  projectExperiences: Record<string, unknown>[];
  jobSearchPreferences?: JobSearchPreferences;
};

export type RecommendationProfileVectorDocument = {
  content: string;
  metadata: Record<string, unknown>;
  updatedAt?: string;
};

function resolveClient(client?: SupabaseQueryClient) {
  return client ?? getSupabaseAdminClient();
}

function normalizeResumeStatus(value: string | null): ResumeRecordStatus {
  if (
    value === "uploaded" ||
    value === "processing" ||
    value === "completed" ||
    value === "failed"
  ) {
    return value;
  }
  return "uploaded";
}

function mapResumeRow(row: ResumeRow): ResumeRecord {
  return {
    id: row.id,
    userId: row.user_id,
    storagePath: row.storage_path ?? "",
    fileName:
      row.file_name ?? row.storage_path?.split("/").pop() ?? "未命名简历.pdf",
    fileUrl: row.file_url,
    parsedText: row.parsed_text ?? undefined,
    parsedJson: row.parsed_json ?? undefined,
    processingStatus: normalizeResumeStatus(row.processing_status),
    uploadedAt: row.uploaded_at ?? new Date().toISOString(),
    lastProcessedAt: row.last_processed_at ?? undefined,
  };
}

function normalizeJobSourceSessionStatus(
  value: string | null,
): JobSourceSessionStatus {
  return value === "invalid" ? "invalid" : "connected";
}

function mapJobSourceSessionRow(row: JobSourceSessionRow): JobSourceSession {
  return {
    id: row.id,
    userId: row.user_id,
    source: row.source,
    status: normalizeJobSourceSessionStatus(row.status),
    validationError: row.validation_error ?? undefined,
    lastValidatedAt: row.last_validated_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapJobSourceSessionRecord(
  row: JobSourceSessionRow,
): JobSourceSessionRecord {
  return {
    ...mapJobSourceSessionRow(row),
    credential: {
      cookie: row.credential?.cookie ?? "",
    },
  };
}

function mapJobRecommendationJobRow(
  row: JobRow<JobRecommendationJobPayload, JobRecommendationResult>,
): JobRecommendationJob {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    payload: row.input_payload,
    result: row.result_payload ?? undefined,
    errorMessage: row.error_message ?? undefined,
    providerId: row.provider_id ?? undefined,
    model: row.model ?? undefined,
    attemptCount: row.attempt_count ?? 0,
    availableAt: row.available_at ?? row.created_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapJobRecommendationFeedbackRow(
  row: JobRecommendationFeedbackRow,
): JobRecommendationFeedback {
  return {
    id: row.id,
    userId: row.user_id,
    source: row.source,
    sourceJobId: row.source_job_id,
    action: row.action,
    jobSnapshot: row.job_snapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeJobSearchPreferences(
  raw: unknown,
): JobSearchPreferences | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const record = raw as Record<string, unknown>;
  return {
    cities: toStringArray(record.cities),
    salaryMinK: normalizeOptionalNumber(record.salaryMinK),
    salaryMaxK: normalizeOptionalNumber(record.salaryMaxK),
    role: normalizeOptionalString(record.role),
    industries: toStringArray(record.industries),
    companySizes: toStringArray(record.companySizes),
  };
}

function mapRecommendationUserProfile(
  row: UserProfileRow,
): RecommendationUserProfile {
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname ?? undefined,
    bio: row.bio ?? undefined,
    jobIntention: row.job_intention ?? undefined,
    companyIntention: row.company_intention ?? undefined,
    experienceYears:
      typeof row.experience_years === "number"
        ? row.experience_years
        : undefined,
    skills: Array.isArray(row.skills) ? row.skills.filter(Boolean) : [],
    workExperiences: Array.isArray(row.work_experiences)
      ? row.work_experiences
      : [],
    projectExperiences: Array.isArray(row.project_experiences)
      ? row.project_experiences
      : [],
    jobSearchPreferences: normalizeJobSearchPreferences(
      row.job_search_preferences,
    ),
  };
}

export async function loadRecommendationUserProfile(
  userId: string,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("user_profiles")
    .select(
      "id, user_id, nickname, bio, job_intention, company_intention, experience_years, skills, work_experiences, project_experiences, job_search_preferences",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load recommendation user profile: ${error.message}`,
    );
  }

  return data ? mapRecommendationUserProfile(data as UserProfileRow) : null;
}

export async function saveJobSearchPreferencesForUser(
  input: {
    userId: string;
    preferences: JobSearchPreferences;
  },
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const now = new Date().toISOString();
  const payload = {
    id: input.userId,
    user_id: input.userId,
    job_search_preferences: sanitizeDatabaseValue(input.preferences),
    updated_at: now,
  };

  const { data, error } = await resolvedClient
    .from("user_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("job_search_preferences")
    .single();

  if (error || !data) {
    throw new Error(`Failed to save job search preferences: ${error?.message}`);
  }

  return (
    normalizeJobSearchPreferences(
      (data as { job_search_preferences?: unknown }).job_search_preferences,
    ) ?? input.preferences
  );
}

export async function loadLatestResumeRecordForUser(
  userId: string,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("resumes")
    .select("*")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Failed to load latest resume record: ${error.message}`);
  }

  const row = (data ?? [])[0] as ResumeRow | undefined;
  return row ? mapResumeRow(row) : null;
}

export async function loadRecommendationProfileVectorsForUser(
  userId: string,
  limit = 12,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("user_profile_vectors")
    .select("content, metadata, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      `Failed to load recommendation profile vectors: ${error.message}`,
    );
  }

  return ((data ?? []) as UserProfileVectorRow[]).map((row) => ({
    content: row.content,
    metadata: row.metadata ?? {},
    updatedAt: row.updated_at ?? undefined,
  }));
}

export async function upsertJobSourceSession(
  input: {
    userId: string;
    source: JobSource;
    credential: JobSourceSessionCredential;
    status: JobSourceSessionStatus;
    validationError?: string;
    lastValidatedAt?: string;
  },
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("job_source_sessions")
    .upsert(
      {
        user_id: input.userId,
        source: input.source,
        credential: sanitizeDatabaseValue(input.credential),
        status: input.status,
        validation_error: sanitizeDatabaseValue(input.validationError ?? null),
        last_validated_at: sanitizeDatabaseValue(input.lastValidatedAt ?? null),
      },
      { onConflict: "user_id,source" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to upsert job source session: ${error?.message}`);
  }

  return mapJobSourceSessionRecord(data as JobSourceSessionRow);
}

export async function getJobSourceSessionForUser(
  userId: string,
  source: JobSource,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("job_source_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("source", source)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load job source session: ${error.message}`);
  }

  return data ? mapJobSourceSessionRow(data as JobSourceSessionRow) : null;
}

export async function getJobSourceSessionWithCredentialForUser(
  userId: string,
  source: JobSource,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("job_source_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("source", source)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load job source session credential: ${error.message}`,
    );
  }

  return data ? mapJobSourceSessionRecord(data as JobSourceSessionRow) : null;
}

export async function deleteJobSourceSessionForUser(
  userId: string,
  source: JobSource,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { error } = await resolvedClient
    .from("job_source_sessions")
    .delete()
    .eq("user_id", userId)
    .eq("source", source);

  if (error) {
    throw new Error(`Failed to delete job source session: ${error.message}`);
  }
}

export async function createJobRecommendationJob(
  input: {
    userId: string;
    payload: JobRecommendationJobPayload;
  },
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("job_recommendation_jobs")
    .insert({
      user_id: input.userId,
      input_payload: sanitizeDatabaseValue(input.payload),
      status: "queued",
      attempt_count: 0,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create job recommendation job: ${error?.message}`,
    );
  }

  return mapJobRecommendationJobRow(
    data as JobRow<JobRecommendationJobPayload, JobRecommendationResult>,
  );
}

export async function getJobRecommendationJobForUser(
  jobId: string,
  userId: string,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("job_recommendation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load job recommendation job: ${error.message}`);
  }

  return data
    ? mapJobRecommendationJobRow(
        data as JobRow<JobRecommendationJobPayload, JobRecommendationResult>,
      )
    : null;
}

export async function listJobRecommendationJobsForUser(
  userId: string,
  limit = 20,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("job_recommendation_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list job recommendation jobs: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    mapJobRecommendationJobRow(
      row as JobRow<JobRecommendationJobPayload, JobRecommendationResult>,
    ),
  );
}

export async function claimNextJobRecommendationJob() {
  const client = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const staleThreshold = new Date(Date.now() - 10 * 60_000).toISOString();

  await client
    .from("job_recommendation_jobs")
    .update({
      status: "queued",
      started_at: null,
      error_message: "reset: stale running job recovered",
      updated_at: now,
    })
    .eq("status", "running")
    .lt("updated_at", staleThreshold);

  const { data, error } = await client
    .from("job_recommendation_jobs")
    .select("*")
    .in("status", ["queued"])
    .lte("available_at", now)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(
      `Failed to query job recommendation jobs: ${error.message}`,
    );
  }

  for (const row of data ?? []) {
    const current = row as JobRow<
      JobRecommendationJobPayload,
      JobRecommendationResult
    >;
    const { data: claimed, error: claimError } = await client
      .from("job_recommendation_jobs")
      .update({
        status: "running",
        started_at: now,
        updated_at: now,
        error_message: null,
      })
      .eq("id", current.id)
      .eq("status", current.status)
      .select("*")
      .maybeSingle();

    if (!claimError && claimed) {
      return mapJobRecommendationJobRow(
        claimed as JobRow<JobRecommendationJobPayload, JobRecommendationResult>,
      );
    }
  }

  return null;
}

export async function completeJobRecommendationJob(input: {
  jobId: string;
  providerId?: string;
  model?: string;
  result: JobRecommendationResult;
}) {
  const client = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await client
    .from("job_recommendation_jobs")
    .update({
      status: "succeeded",
      result_payload: sanitizeDatabaseValue(input.result),
      provider_id: sanitizeDatabaseValue(input.providerId ?? null),
      model: sanitizeDatabaseValue(input.model ?? null),
      completed_at: now,
      updated_at: now,
      error_message: null,
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(
      `Failed to complete job recommendation job: ${error.message}`,
    );
  }
}

export async function failJobRecommendationJob(input: {
  jobId: string;
  errorMessage: string;
  providerId?: string;
  model?: string;
  terminal?: boolean;
}) {
  const client = getSupabaseAdminClient();
  const { data: current, error: loadError } = await client
    .from("job_recommendation_jobs")
    .select("attempt_count")
    .eq("id", input.jobId)
    .single();

  if (loadError || !current) {
    throw new Error(
      `Failed to load job recommendation attempt count: ${loadError?.message}`,
    );
  }

  const nextAttempt = (current.attempt_count ?? 0) + 1;
  const now = new Date().toISOString();
  const availableAt = new Date(
    Date.now() + JOB_RETRY_DELAY_MINUTES * 60_000,
  ).toISOString();
  const status: LlmJobStatus =
    input.terminal || nextAttempt >= 3 ? "failed" : "queued";

  const { error } = await client
    .from("job_recommendation_jobs")
    .update({
      status,
      error_message: sanitizeDatabaseValue(input.errorMessage),
      provider_id: sanitizeDatabaseValue(input.providerId ?? null),
      model: sanitizeDatabaseValue(input.model ?? null),
      attempt_count: nextAttempt,
      available_at: status === "queued" ? availableAt : now,
      updated_at: now,
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(`Failed to fail job recommendation job: ${error.message}`);
  }
}

export async function upsertJobRecommendationFeedback(
  input: {
    userId: string;
    source: JobSource;
    sourceJobId: string;
    action: JobRecommendationFeedbackAction;
    jobSnapshot: RecommendedJob;
  },
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("job_recommendation_feedback")
    .upsert(
      {
        user_id: input.userId,
        source: input.source,
        source_job_id: sanitizeDatabaseValue(input.sourceJobId),
        action: input.action,
        job_snapshot: sanitizeDatabaseValue(input.jobSnapshot),
      },
      { onConflict: "user_id,source,source_job_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to upsert job recommendation feedback: ${error?.message}`,
    );
  }

  return mapJobRecommendationFeedbackRow(data as JobRecommendationFeedbackRow);
}

export async function listJobRecommendationFeedbackForUser(
  input: {
    userId: string;
    source?: JobSource;
    sourceJobIds?: string[];
  },
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  let query = resolvedClient
    .from("job_recommendation_feedback")
    .select("*")
    .eq("user_id", input.userId);

  if (input.source) {
    query = query.eq("source", input.source);
  }

  if (input.sourceJobIds?.length) {
    query = query.in("source_job_id", input.sourceJobIds);
  }

  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error) {
    throw new Error(
      `Failed to list job recommendation feedback: ${error.message}`,
    );
  }

  return ((data ?? []) as JobRecommendationFeedbackRow[]).map((row) =>
    mapJobRecommendationFeedbackRow(row),
  );
}

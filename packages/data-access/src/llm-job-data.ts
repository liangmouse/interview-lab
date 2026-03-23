import type {
  LlmJobStatus,
  QuestioningJob,
  QuestioningJobPayload,
  QuestioningReport,
  ResumeRecord,
  ResumeRecordStatus,
  ResumeReviewJob,
  ResumeReviewJobPayload,
  ResumeReviewResult,
} from "@interviewclaw/domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase-admin";

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

const JOB_RETRY_DELAY_MINUTES = 5;
type SupabaseQueryClient = Pick<SupabaseClient, "from">;

function resolveClient(client?: SupabaseQueryClient) {
  return client ?? getSupabaseAdminClient();
}

export function sanitizeDatabaseValue<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeDatabaseString(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDatabaseValue(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sanitizeDatabaseValue(entry),
      ]),
    ) as T;
  }

  return value;
}

function sanitizeDatabaseString(value: string) {
  let output = "";

  for (let index = 0; index < value.length; index += 1) {
    const current = value.charCodeAt(index);

    if (current === 0) {
      continue;
    }

    if (current >= 0xd800 && current <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        output += value[index] + value[index + 1];
        index += 1;
      } else {
        output += "\uFFFD";
      }
      continue;
    }

    if (current >= 0xdc00 && current <= 0xdfff) {
      output += "\uFFFD";
      continue;
    }

    output += value[index];
  }

  return output;
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

function mapResumeReviewJobRow(
  row: JobRow<ResumeReviewJobPayload, ResumeReviewResult>,
): ResumeReviewJob {
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

function mapQuestioningJobRow(
  row: JobRow<QuestioningJobPayload, QuestioningReport>,
): QuestioningJob {
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

export async function upsertResumeRecord(
  input: {
    userId: string;
    storagePath: string;
    fileUrl: string;
    fileName: string;
    parsedText?: string;
    parsedJson?: Record<string, unknown>;
    processingStatus?: ResumeRecordStatus;
    lastProcessedAt?: string;
  },
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const payload = {
    user_id: input.userId,
    storage_path: sanitizeDatabaseValue(input.storagePath),
    file_url: sanitizeDatabaseValue(input.fileUrl),
    file_name: sanitizeDatabaseValue(input.fileName),
    ...(input.parsedText !== undefined
      ? { parsed_text: sanitizeDatabaseValue(input.parsedText) }
      : {}),
    ...(input.parsedJson !== undefined
      ? { parsed_json: sanitizeDatabaseValue(input.parsedJson) }
      : {}),
    ...(input.processingStatus
      ? { processing_status: sanitizeDatabaseValue(input.processingStatus) }
      : {}),
    ...(input.lastProcessedAt
      ? { last_processed_at: sanitizeDatabaseValue(input.lastProcessedAt) }
      : {}),
  };

  const { data, error } = await resolvedClient
    .from("resumes")
    .upsert(payload, { onConflict: "storage_path" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to upsert resume record: ${error?.message}`);
  }

  return mapResumeRow(data as ResumeRow);
}

export async function getResumeRecordByStoragePath(
  userId: string,
  storagePath: string,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("resumes")
    .select("*")
    .eq("user_id", userId)
    .eq("storage_path", storagePath)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load resume record: ${error.message}`);
  }

  return data ? mapResumeRow(data as ResumeRow) : null;
}

export async function deleteResumeRecordByStoragePath(
  userId: string,
  storagePath: string,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { error } = await resolvedClient
    .from("resumes")
    .delete()
    .eq("user_id", userId)
    .eq("storage_path", storagePath);

  if (error) {
    throw new Error(`Failed to delete resume record: ${error.message}`);
  }
}

export async function createResumeReviewJob(
  input: {
    userId: string;
    payload: ResumeReviewJobPayload;
  },
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("resume_review_jobs")
    .insert({
      user_id: input.userId,
      input_payload: sanitizeDatabaseValue(input.payload),
      status: "queued",
      attempt_count: 0,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create resume review job: ${error?.message}`);
  }

  return mapResumeReviewJobRow(
    data as JobRow<ResumeReviewJobPayload, ResumeReviewResult>,
  );
}

export async function getResumeReviewJobForUser(
  jobId: string,
  userId: string,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("resume_review_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load resume review job: ${error.message}`);
  }

  return data
    ? mapResumeReviewJobRow(
        data as JobRow<ResumeReviewJobPayload, ResumeReviewResult>,
      )
    : null;
}

export async function listResumeReviewJobsForUser(
  userId: string,
  limit = 20,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("resume_review_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list resume review jobs: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    mapResumeReviewJobRow(
      row as JobRow<ResumeReviewJobPayload, ResumeReviewResult>,
    ),
  );
}

export async function claimNextResumeReviewJob() {
  const client = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("resume_review_jobs")
    .select("*")
    .in("status", ["queued", "failed"])
    .lte("available_at", now)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(`Failed to query resume review jobs: ${error.message}`);
  }

  for (const row of data ?? []) {
    const current = row as JobRow<ResumeReviewJobPayload, ResumeReviewResult>;
    const { data: claimed, error: claimError } = await client
      .from("resume_review_jobs")
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
      return mapResumeReviewJobRow(
        claimed as JobRow<ResumeReviewJobPayload, ResumeReviewResult>,
      );
    }
  }

  return null;
}

export async function completeResumeReviewJob(input: {
  jobId: string;
  providerId?: string;
  model?: string;
  result: ResumeReviewResult;
}) {
  const client = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await client
    .from("resume_review_jobs")
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
    throw new Error(`Failed to complete resume review job: ${error.message}`);
  }
}

export async function failResumeReviewJob(input: {
  jobId: string;
  errorMessage: string;
  providerId?: string;
  model?: string;
}) {
  const client = getSupabaseAdminClient();
  const { data: current, error: loadError } = await client
    .from("resume_review_jobs")
    .select("attempt_count")
    .eq("id", input.jobId)
    .single();

  if (loadError || !current) {
    throw new Error(
      `Failed to load resume review job attempt count: ${loadError?.message}`,
    );
  }

  const nextAttempt = (current.attempt_count ?? 0) + 1;
  const now = new Date().toISOString();
  const availableAt = new Date(
    Date.now() + JOB_RETRY_DELAY_MINUTES * 60_000,
  ).toISOString();
  const status: LlmJobStatus = nextAttempt >= 3 ? "failed" : "queued";

  const { error } = await client
    .from("resume_review_jobs")
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
    throw new Error(`Failed to fail resume review job: ${error.message}`);
  }
}

export async function createQuestioningJob(
  input: {
    userId: string;
    payload: QuestioningJobPayload;
  },
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("questioning_jobs")
    .insert({
      user_id: input.userId,
      input_payload: sanitizeDatabaseValue(input.payload),
      status: "queued",
      attempt_count: 0,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create questioning job: ${error?.message}`);
  }

  return mapQuestioningJobRow(
    data as JobRow<QuestioningJobPayload, QuestioningReport>,
  );
}

export async function getQuestioningJobForUser(
  jobId: string,
  userId: string,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("questioning_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load questioning job: ${error.message}`);
  }

  return data
    ? mapQuestioningJobRow(
        data as JobRow<QuestioningJobPayload, QuestioningReport>,
      )
    : null;
}

export async function listQuestioningJobsForUser(
  userId: string,
  limit = 20,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("questioning_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list questioning jobs: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    mapQuestioningJobRow(
      row as JobRow<QuestioningJobPayload, QuestioningReport>,
    ),
  );
}

export async function claimNextQuestioningJob() {
  const client = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("questioning_jobs")
    .select("*")
    .in("status", ["queued", "failed"])
    .lte("available_at", now)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(`Failed to query questioning jobs: ${error.message}`);
  }

  for (const row of data ?? []) {
    const current = row as JobRow<QuestioningJobPayload, QuestioningReport>;
    const { data: claimed, error: claimError } = await client
      .from("questioning_jobs")
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
      return mapQuestioningJobRow(
        claimed as JobRow<QuestioningJobPayload, QuestioningReport>,
      );
    }
  }

  return null;
}

export async function completeQuestioningJob(input: {
  jobId: string;
  providerId?: string;
  model?: string;
  result: QuestioningReport;
}) {
  const client = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await client
    .from("questioning_jobs")
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
    throw new Error(`Failed to complete questioning job: ${error.message}`);
  }
}

export async function failQuestioningJob(input: {
  jobId: string;
  errorMessage: string;
  providerId?: string;
  model?: string;
}) {
  const client = getSupabaseAdminClient();
  const { data: current, error: loadError } = await client
    .from("questioning_jobs")
    .select("attempt_count")
    .eq("id", input.jobId)
    .single();

  if (loadError || !current) {
    throw new Error(
      `Failed to load questioning job attempt count: ${loadError?.message}`,
    );
  }

  const nextAttempt = (current.attempt_count ?? 0) + 1;
  const now = new Date().toISOString();
  const availableAt = new Date(
    Date.now() + JOB_RETRY_DELAY_MINUTES * 60_000,
  ).toISOString();
  const status: LlmJobStatus = nextAttempt >= 3 ? "failed" : "queued";

  const { error } = await client
    .from("questioning_jobs")
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
    throw new Error(`Failed to fail questioning job: ${error.message}`);
  }
}

import type {
  LlmJobStatus,
  ResumeGenerationDirectionPreset,
  ResumeGenerationJob,
  ResumeGenerationJobPayload,
  ResumeGenerationLanguage,
  ResumeGenerationMessage,
  ResumeGenerationMissingField,
  ResumeGenerationResult,
  ResumeGenerationSession,
  ResumeGenerationSessionStatus,
  ResumePortraitDraft,
  ResumeVersion,
} from "@interviewclaw/domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeDatabaseValue } from "./llm-job-data";
import { getSupabaseAdminClient } from "./supabase-admin";

type SupabaseQueryClient = Pick<SupabaseClient, "from">;

type ResumeGenerationSessionRow = {
  id: string;
  user_id: string;
  source_resume_storage_path: string;
  direction_preset: ResumeGenerationDirectionPreset;
  custom_style_prompt: string | null;
  language: ResumeGenerationLanguage;
  session_status: string | null;
  portrait_draft: ResumePortraitDraft | null;
  missing_fields: ResumeGenerationMissingField[] | null;
  assistant_question: string | null;
  suggested_answer_hints: string[] | null;
  messages: ResumeGenerationMessage[] | null;
  created_at: string;
  updated_at: string;
};

type ResumeGenerationJobRow = {
  id: string;
  user_id: string;
  status: LlmJobStatus;
  input_payload: ResumeGenerationJobPayload;
  result_payload: ResumeGenerationResult | null;
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

type ResumeVersionRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  source_resume_storage_path: string;
  direction_preset: ResumeGenerationDirectionPreset;
  custom_style_prompt: string | null;
  language: ResumeGenerationLanguage;
  title: string;
  summary: string;
  preview_slug: string;
  markdown_storage_path: string;
  markdown_content: string;
  created_at: string;
  updated_at: string;
};

const JOB_RETRY_DELAY_MINUTES = 5;

function resolveClient(client?: SupabaseQueryClient) {
  return client ?? getSupabaseAdminClient();
}

function normalizeSessionStatus(
  value: string | null,
): ResumeGenerationSessionStatus {
  if (value === "ready" || value === "archived") {
    return value;
  }
  return "collecting";
}

function mapResumeGenerationSessionRow(
  row: ResumeGenerationSessionRow,
): ResumeGenerationSession {
  return {
    id: row.id,
    userId: row.user_id,
    sourceResumeStoragePath: row.source_resume_storage_path,
    directionPreset: row.direction_preset,
    customStylePrompt: row.custom_style_prompt ?? undefined,
    language: row.language,
    sessionStatus: normalizeSessionStatus(row.session_status),
    portraitDraft:
      row.portrait_draft ??
      ({
        directionPreset: row.direction_preset,
        language: row.language,
        skills: [],
        workExperiences: [],
        projectExperiences: [],
        rawUserNotes: [],
      } satisfies ResumePortraitDraft),
    missingFields: row.missing_fields ?? [],
    assistantQuestion: row.assistant_question ?? undefined,
    suggestedAnswerHints: row.suggested_answer_hints ?? [],
    messages: row.messages ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapResumeGenerationJobRow(
  row: ResumeGenerationJobRow,
): ResumeGenerationJob {
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

function mapResumeVersionRow(row: ResumeVersionRow): ResumeVersion {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id ?? undefined,
    sourceResumeStoragePath: row.source_resume_storage_path,
    directionPreset: row.direction_preset,
    customStylePrompt: row.custom_style_prompt ?? undefined,
    language: row.language,
    title: row.title,
    summary: row.summary,
    previewSlug: row.preview_slug,
    markdownStoragePath: row.markdown_storage_path,
    markdownContent: row.markdown_content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createResumeGenerationSession(
  input: {
    userId: string;
    sourceResumeStoragePath: string;
    directionPreset: ResumeGenerationDirectionPreset;
    customStylePrompt?: string;
    language: ResumeGenerationLanguage;
    sessionStatus: ResumeGenerationSessionStatus;
    portraitDraft: ResumePortraitDraft;
    missingFields: ResumeGenerationMissingField[];
    assistantQuestion?: string;
    suggestedAnswerHints?: string[];
    messages?: ResumeGenerationMessage[];
  },
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("resume_generation_sessions")
    .insert({
      user_id: input.userId,
      source_resume_storage_path: sanitizeDatabaseValue(
        input.sourceResumeStoragePath,
      ),
      direction_preset: sanitizeDatabaseValue(input.directionPreset),
      custom_style_prompt: sanitizeDatabaseValue(
        input.customStylePrompt ?? null,
      ),
      language: sanitizeDatabaseValue(input.language),
      session_status: sanitizeDatabaseValue(input.sessionStatus),
      portrait_draft: sanitizeDatabaseValue(input.portraitDraft),
      missing_fields: sanitizeDatabaseValue(input.missingFields),
      assistant_question: sanitizeDatabaseValue(
        input.assistantQuestion ?? null,
      ),
      suggested_answer_hints: sanitizeDatabaseValue(
        input.suggestedAnswerHints ?? [],
      ),
      messages: sanitizeDatabaseValue(input.messages ?? []),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create resume generation session: ${error?.message}`,
    );
  }

  return mapResumeGenerationSessionRow(data as ResumeGenerationSessionRow);
}

export async function getResumeGenerationSessionForUser(
  sessionId: string,
  userId: string,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("resume_generation_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load resume generation session: ${error.message}`,
    );
  }

  return data
    ? mapResumeGenerationSessionRow(data as ResumeGenerationSessionRow)
    : null;
}

export async function updateResumeGenerationSession(
  input: {
    sessionId: string;
    userId: string;
    sessionStatus?: ResumeGenerationSessionStatus;
    portraitDraft?: ResumePortraitDraft;
    missingFields?: ResumeGenerationMissingField[];
    assistantQuestion?: string | null;
    suggestedAnswerHints?: string[];
    messages?: ResumeGenerationMessage[];
  },
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.sessionStatus !== undefined) {
    payload.session_status = sanitizeDatabaseValue(input.sessionStatus);
  }
  if (input.portraitDraft !== undefined) {
    payload.portrait_draft = sanitizeDatabaseValue(input.portraitDraft);
  }
  if (input.missingFields !== undefined) {
    payload.missing_fields = sanitizeDatabaseValue(input.missingFields);
  }
  if (input.assistantQuestion !== undefined) {
    payload.assistant_question = sanitizeDatabaseValue(
      input.assistantQuestion ?? null,
    );
  }
  if (input.suggestedAnswerHints !== undefined) {
    payload.suggested_answer_hints = sanitizeDatabaseValue(
      input.suggestedAnswerHints,
    );
  }
  if (input.messages !== undefined) {
    payload.messages = sanitizeDatabaseValue(input.messages);
  }

  const { data, error } = await resolvedClient
    .from("resume_generation_sessions")
    .update(payload)
    .eq("id", input.sessionId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to update resume generation session: ${error?.message}`,
    );
  }

  return mapResumeGenerationSessionRow(data as ResumeGenerationSessionRow);
}

export async function createResumeGenerationJob(
  input: {
    userId: string;
    payload: ResumeGenerationJobPayload;
  },
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("resume_generation_jobs")
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
      `Failed to create resume generation job: ${error?.message}`,
    );
  }

  return mapResumeGenerationJobRow(data as ResumeGenerationJobRow);
}

export async function getResumeGenerationJobForUser(
  jobId: string,
  userId: string,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("resume_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load resume generation job: ${error.message}`);
  }

  return data
    ? mapResumeGenerationJobRow(data as ResumeGenerationJobRow)
    : null;
}

export async function listResumeGenerationJobsForUser(
  userId: string,
  limit = 20,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("resume_generation_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list resume generation jobs: ${error.message}`);
  }

  return ((data ?? []) as ResumeGenerationJobRow[]).map(
    mapResumeGenerationJobRow,
  );
}

export async function claimNextResumeGenerationJob() {
  const client = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const staleThreshold = new Date(Date.now() - 10 * 60_000).toISOString();

  await client
    .from("resume_generation_jobs")
    .update({
      status: "queued",
      started_at: null,
      error_message: "reset: stale running job recovered",
      updated_at: now,
    })
    .eq("status", "running")
    .lt("updated_at", staleThreshold);

  const { data, error } = await client
    .from("resume_generation_jobs")
    .select("*")
    .in("status", ["queued"])
    .lte("available_at", now)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(`Failed to query resume generation jobs: ${error.message}`);
  }

  for (const row of data ?? []) {
    const current = row as ResumeGenerationJobRow;
    const { data: claimed, error: claimError } = await client
      .from("resume_generation_jobs")
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
      return mapResumeGenerationJobRow(claimed as ResumeGenerationJobRow);
    }
  }

  return null;
}

export async function completeResumeGenerationJob(input: {
  jobId: string;
  providerId?: string;
  model?: string;
  result: ResumeGenerationResult;
}) {
  const client = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await client
    .from("resume_generation_jobs")
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
      `Failed to complete resume generation job: ${error.message}`,
    );
  }
}

export async function failResumeGenerationJob(input: {
  jobId: string;
  errorMessage: string;
  providerId?: string;
  model?: string;
  terminal?: boolean;
}) {
  const client = getSupabaseAdminClient();
  const { data: current, error: loadError } = await client
    .from("resume_generation_jobs")
    .select("attempt_count")
    .eq("id", input.jobId)
    .single();

  if (loadError || !current) {
    throw new Error(
      `Failed to load resume generation job attempt count: ${loadError?.message}`,
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
    .from("resume_generation_jobs")
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
    throw new Error(`Failed to fail resume generation job: ${error.message}`);
  }
}

export async function createResumeVersion(
  input: {
    userId: string;
    sessionId?: string;
    sourceResumeStoragePath: string;
    directionPreset: ResumeGenerationDirectionPreset;
    customStylePrompt?: string;
    language: ResumeGenerationLanguage;
    title: string;
    summary: string;
    previewSlug: string;
    markdownStoragePath: string;
    markdownContent: string;
  },
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("resume_versions")
    .upsert(
      {
        user_id: input.userId,
        session_id: sanitizeDatabaseValue(input.sessionId ?? null),
        source_resume_storage_path: sanitizeDatabaseValue(
          input.sourceResumeStoragePath,
        ),
        direction_preset: sanitizeDatabaseValue(input.directionPreset),
        custom_style_prompt: sanitizeDatabaseValue(
          input.customStylePrompt ?? null,
        ),
        language: sanitizeDatabaseValue(input.language),
        title: sanitizeDatabaseValue(input.title),
        summary: sanitizeDatabaseValue(input.summary),
        preview_slug: sanitizeDatabaseValue(input.previewSlug),
        markdown_storage_path: sanitizeDatabaseValue(input.markdownStoragePath),
        markdown_content: sanitizeDatabaseValue(input.markdownContent),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "preview_slug",
      },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create resume version: ${error?.message}`);
  }

  return mapResumeVersionRow(data as ResumeVersionRow);
}

export async function listResumeVersionsForUser(
  userId: string,
  limit = 20,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("resume_versions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list resume versions: ${error.message}`);
  }

  return ((data ?? []) as ResumeVersionRow[]).map(mapResumeVersionRow);
}

export async function getResumeVersionForUser(
  versionId: string,
  userId: string,
  client?: SupabaseQueryClient,
) {
  const resolvedClient = resolveClient(client);
  const { data, error } = await resolvedClient
    .from("resume_versions")
    .select("*")
    .eq("id", versionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load resume version: ${error.message}`);
  }

  return data ? mapResumeVersionRow(data as ResumeVersionRow) : null;
}

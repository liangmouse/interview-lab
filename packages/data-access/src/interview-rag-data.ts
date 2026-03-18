import type {
  CandidateStateSnapshot,
  InterviewDecision,
  InterviewPlan,
  InterviewerProfile,
  QuestionAsset,
  RoleFamily,
  Seniority,
} from "@interviewclaw/domain";
import { getSupabaseAdminClient } from "./supabase-admin";

type QuestionAssetRow = {
  id: string;
  question_text: string;
  reference_answer: string | null;
  question_type: QuestionAsset["questionType"];
  role_family: RoleFamily;
  seniority: Seniority;
  topics: string[] | null;
  difficulty: number | null;
  expected_signals: string[] | null;
  good_answer_rubric: string[] | null;
  bad_answer_patterns: string[] | null;
  follow_up_templates: QuestionAsset["followUpTemplates"] | null;
  source_type: string;
  source_ref: string | null;
  quality_score: number | null;
  language: string | null;
  company_tag: string | null;
};

function mapQuestionAsset(row: QuestionAssetRow): QuestionAsset {
  return {
    id: row.id,
    questionText: row.question_text,
    referenceAnswer: row.reference_answer ?? undefined,
    questionType: row.question_type,
    roleFamily: row.role_family,
    seniority: row.seniority,
    topics: row.topics ?? [],
    difficulty: row.difficulty ?? 3,
    expectedSignals: row.expected_signals ?? [],
    goodAnswerRubric: row.good_answer_rubric ?? [],
    badAnswerPatterns: row.bad_answer_patterns ?? [],
    followUpTemplates: row.follow_up_templates ?? {},
    sourceType: row.source_type,
    sourceRef: row.source_ref ?? undefined,
    qualityScore: row.quality_score ?? 0.7,
    language: row.language ?? "zh",
    companyTag: row.company_tag ?? undefined,
  };
}

export async function loadQuestionAssets(filters: {
  roleFamily?: RoleFamily;
  seniority?: Seniority;
  companyTag?: string;
  limit?: number;
}) {
  const client = getSupabaseAdminClient();
  let query = client
    .from("question_assets")
    .select("*")
    .order("quality_score", { ascending: false })
    .limit(filters.limit ?? 30);

  if (filters.roleFamily) {
    query = query.in("role_family", [filters.roleFamily, "general"]);
  }
  if (filters.seniority) {
    query = query.in("seniority", [filters.seniority, "junior", "mid"]);
  }
  if (filters.companyTag) {
    query = query.eq("company_tag", filters.companyTag);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load question assets: ${error.message}`);
  }

  return (data ?? []).map((row) => mapQuestionAsset(row as QuestionAssetRow));
}

export async function ingestQuestionAssets(
  assets: Array<Partial<QuestionAsset> & Pick<QuestionAsset, "questionText">>,
) {
  const client = getSupabaseAdminClient();
  const rows = assets.map((asset) => ({
    question_text: asset.questionText,
    reference_answer: asset.referenceAnswer ?? null,
    question_type: asset.questionType ?? "knowledge",
    role_family: asset.roleFamily ?? "general",
    seniority: asset.seniority ?? "junior",
    topics: asset.topics ?? [],
    difficulty: asset.difficulty ?? 3,
    expected_signals: asset.expectedSignals ?? [],
    good_answer_rubric: asset.goodAnswerRubric ?? [],
    bad_answer_patterns: asset.badAnswerPatterns ?? [],
    follow_up_templates: asset.followUpTemplates ?? {},
    source_type: asset.sourceType ?? "manual",
    source_ref: asset.sourceRef ?? null,
    quality_score: asset.qualityScore ?? 0.7,
    language: asset.language ?? "zh",
    company_tag: asset.companyTag ?? null,
  }));

  const { data, error } = await client
    .from("question_assets")
    .insert(rows)
    .select("*");

  if (error) {
    throw new Error(`Failed to ingest question assets: ${error.message}`);
  }

  return (data ?? []).map((row) => mapQuestionAsset(row as QuestionAssetRow));
}

export async function loadInterviewerProfile(filters: {
  roleFamily?: RoleFamily;
  companyTag?: string;
}) {
  const client = getSupabaseAdminClient();
  let query = client
    .from("interviewer_profiles")
    .select("*")
    .limit(1)
    .order("updated_at", { ascending: false });

  if (filters.companyTag) {
    query = query.eq("company_tag", filters.companyTag);
  } else if (filters.roleFamily) {
    query = query.eq("role_family", filters.roleFamily);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load interviewer profile: ${error.message}`);
  }

  const row = data?.[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    scope: row.scope,
    tone: row.tone,
    depthPreference: row.depth_preference,
    algorithmWeight: row.algorithm_weight,
    projectWeight: row.project_weight,
    behaviorWeight: row.behavior_weight,
    followUpStyle: row.follow_up_style,
    roleFamily: row.role_family ?? undefined,
    companyTag: row.company_tag ?? undefined,
  } satisfies InterviewerProfile;
}

export async function loadInterviewPlan(
  interviewId: string,
): Promise<InterviewPlan | null> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("interview_plans")
    .select("*")
    .eq("interview_id", interviewId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load interview plan: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    interviewId: data.interview_id,
    summary: data.summary,
    candidateProfile: data.candidate_profile,
    interviewerProfileId: data.interviewer_profile_id ?? undefined,
    plannedTopics: data.planned_topics ?? [],
    questions: data.questions ?? [],
    createdAt: data.created_at,
  };
}

export async function upsertInterviewPlan(plan: InterviewPlan) {
  const client = getSupabaseAdminClient();
  const { error } = await client.from("interview_plans").upsert(
    {
      interview_id: plan.interviewId,
      summary: plan.summary,
      candidate_profile: plan.candidateProfile,
      interviewer_profile_id: plan.interviewerProfileId ?? null,
      planned_topics: plan.plannedTopics,
      questions: plan.questions,
    },
    { onConflict: "interview_id" },
  );

  if (error) {
    throw new Error(`Failed to save interview plan: ${error.message}`);
  }
}

export async function saveCandidateStateSnapshot(
  snapshot: CandidateStateSnapshot,
) {
  const client = getSupabaseAdminClient();
  const { error } = await client.from("candidate_state_snapshots").insert({
    interview_id: snapshot.interviewId,
    turn_id: snapshot.turnId,
    mastery_by_topic: snapshot.masteryByTopic,
    risk_flags: snapshot.riskFlags,
    coverage_status: snapshot.coverageStatus,
    recommended_next_action: snapshot.recommendedNextAction,
  });

  if (error) {
    throw new Error(
      `Failed to save candidate state snapshot: ${error.message}`,
    );
  }
}

export async function saveInterviewDecision(decision: InterviewDecision) {
  const client = getSupabaseAdminClient();
  const { error } = await client.from("interview_decisions").insert({
    interview_id: decision.interviewId,
    turn_id: decision.turnId,
    selected_question_id: decision.selectedQuestionId,
    retrieval_evidence: decision.retrievalEvidence,
    decision_type: decision.decisionType,
    decision_reason: decision.decisionReason,
    alternative_candidates: decision.alternativeCandidates,
  });

  if (error) {
    throw new Error(`Failed to save interview decision: ${error.message}`);
  }
}

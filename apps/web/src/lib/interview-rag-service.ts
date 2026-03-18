import {
  analyzeAnswer,
  buildEvaluationTrace,
  buildCandidateProfile,
  createInterviewPlan,
  decideFollowUp,
} from "@interviewclaw/agent-core";
import type {
  AnswerSignalAnalysis,
  EvaluationTrace,
  FollowUpDecision,
  InterviewPlan,
  InterviewPlanQuestion,
} from "@interviewclaw/domain";
import {
  loadInterviewPlan,
  loadInterviewerProfile,
  loadQuestionAssets,
  saveCandidateStateSnapshot,
  saveInterviewDecision,
  upsertInterviewPlan,
} from "@interviewclaw/data-access";
import { createClient } from "@/lib/supabase/server";

type OwnedInterviewContext = {
  userId: string;
  profileId: string;
  profile: any;
  interview: any;
};

export async function requireOwnedInterview(
  interviewId: string,
): Promise<OwnedInterviewContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw Object.assign(new Error("未登录或登录已过期"), { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    throw Object.assign(new Error("用户资料不存在"), { status: 404 });
  }

  const { data: interview, error: interviewError } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", interviewId)
    .eq("user_id", profile.id)
    .single();

  if (interviewError || !interview) {
    throw Object.assign(new Error("面试不存在"), { status: 404 });
  }

  return {
    userId: user.id,
    profileId: profile.id,
    profile,
    interview,
  };
}

export async function ensureInterviewPlan(
  interviewId: string,
  profile: any,
): Promise<InterviewPlan> {
  const existing = await loadInterviewPlan(interviewId);
  if (existing) {
    return existing;
  }

  const candidateProfile = buildCandidateProfile({
    job_intention: profile.job_intention,
    experience_years: profile.experience_years,
    company_intention: profile.company_intention,
    skills: profile.skills,
  });

  let questionAssets = await loadQuestionAssets({
    roleFamily: candidateProfile.roleFamily,
    seniority: candidateProfile.seniority,
    companyTag: profile.company_intention || undefined,
    limit: 20,
  });
  if (questionAssets.length === 0) {
    questionAssets = await loadQuestionAssets({
      roleFamily: candidateProfile.roleFamily,
      seniority: candidateProfile.seniority,
      limit: 20,
    });
  }
  if (questionAssets.length === 0) {
    questionAssets = await loadQuestionAssets({ limit: 20 });
  }
  const interviewerProfile = await loadInterviewerProfile({
    roleFamily: candidateProfile.roleFamily,
    companyTag: profile.company_intention || undefined,
  });

  const plan = createInterviewPlan({
    interviewId,
    profile: {
      job_intention: profile.job_intention,
      experience_years: profile.experience_years,
      company_intention: profile.company_intention,
      skills: profile.skills,
    },
    questionAssets,
    interviewerProfile,
    limit: 10,
  });

  await upsertInterviewPlan(plan);
  return plan;
}

export function getCurrentQuestion(
  plan: InterviewPlan,
  questionId?: string,
): { question: InterviewPlanQuestion; index: number } {
  if (!plan.questions.length) {
    throw Object.assign(new Error("当前没有可用题目，请先导入题库"), {
      status: 400,
    });
  }

  if (!questionId) {
    return { question: plan.questions[0], index: 0 };
  }

  const index = plan.questions.findIndex(
    (item) => item.questionId === questionId,
  );
  if (index === -1) {
    throw Object.assign(new Error("题目不存在于当前面试计划中"), {
      status: 404,
    });
  }

  return { question: plan.questions[index], index };
}

export async function analyzeInterviewAnswer(args: {
  plan: InterviewPlan;
  questionId: string;
  answer: string;
}) {
  const { question, index } = getCurrentQuestion(args.plan, args.questionId);
  const analysis = analyzeAnswer({
    answer: args.answer,
    question,
  });
  const decision = decideFollowUp({
    plan: args.plan,
    currentQuestion: question,
    currentIndex: index,
    analysis,
  });

  return { question, index, analysis, decision };
}

export async function persistDecisionArtifacts(args: {
  interviewId: string;
  question: InterviewPlanQuestion;
  questionIndex: number;
  analysis: AnswerSignalAnalysis;
  decision: FollowUpDecision;
  plan: InterviewPlan;
}) {
  const turnId = `${Date.now()}`;
  const masteryByTopic = Object.fromEntries(
    args.question.topics.map((topic) => [topic, args.analysis.masteryEstimate]),
  );
  const coverageStatus = Object.fromEntries(
    args.plan.plannedTopics.map((topic) => [
      topic,
      args.question.topics.includes(topic)
        ? ("covered" as const)
        : ("pending" as const),
    ]),
  );

  await saveCandidateStateSnapshot({
    interviewId: args.interviewId,
    turnId,
    masteryByTopic,
    riskFlags: args.analysis.riskFlags,
    coverageStatus,
    recommendedNextAction: args.decision.action,
  });

  await saveInterviewDecision({
    interviewId: args.interviewId,
    turnId,
    selectedQuestionId: args.question.questionId,
    retrievalEvidence: [
      `topics=${args.question.topics.join(",")}`,
      `expected_signals=${args.question.expectedSignals.join(",")}`,
      `plan_index=${args.questionIndex}`,
    ],
    decisionType: args.decision.shouldAdvance
      ? "main_question"
      : args.decision.action,
    decisionReason: args.decision.reason,
    alternativeCandidates: args.plan.questions
      .slice(args.questionIndex + 1, args.questionIndex + 4)
      .map((item) => item.questionId),
  });
}

export function buildTraceFromAnalysis(args: {
  answer: string;
  question: InterviewPlanQuestion;
  analysis: AnswerSignalAnalysis;
  decision: FollowUpDecision;
}): EvaluationTrace {
  return buildEvaluationTrace({
    answer: args.answer,
    question: args.question,
    analysis: args.analysis,
    decision: args.decision,
  });
}

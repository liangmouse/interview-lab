import {
  createLangChainChatModelForUseCase,
  validateLlmConfig,
} from "@interviewclaw/ai-runtime";
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
  QuestionType,
  RiskFlag,
} from "@interviewclaw/domain";
import {
  interviewDataAccess,
  loadInterviewPlan,
  loadInterviewerProfile,
  loadQuestionAssets,
  saveCandidateStateSnapshot,
  saveInterviewDecision,
  upsertInterviewPlan,
} from "@interviewclaw/data-access";
import { mergeMessagesToConversation } from "@/lib/chat-utils";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

type OwnedInterviewContext = {
  userId: string;
  profileId: string;
  profile: any;
  interview: any;
};

type DynamicOpeningResult = {
  question: InterviewPlanQuestion;
  index: number;
  decision: FollowUpDecision;
};

type RecentConversationMessage = {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type DynamicEvaluationResult = {
  currentQuestion: InterviewPlanQuestion;
  decision: FollowUpDecision;
  trace: EvaluationTrace;
  overallScore: number;
  nextQuestion: {
    questionId: string;
    questionText: string;
  };
};

const SELF_INTRO_OPENING_TEMPLATE =
  "你好，欢迎参加今天的{role}面试。先请你做一个简短的自我介绍，重点说说最近做过的项目和你负责的部分。";

const questionTypeSchema = z.enum([
  "knowledge",
  "project",
  "algorithm",
  "system_design",
  "behavioral",
]);

const followUpActionSchema = z.enum([
  "drill_down",
  "ask_example",
  "ask_counterfactual",
  "ask_principle",
  "cross_check",
  "switch_topic",
  "lower_difficulty",
  "raise_difficulty",
]);

const riskFlagSchema = z.enum([
  "vague_answer",
  "no_example",
  "low_metric_detail",
  "role_unclear",
  "possible_bluffing",
  "principle_gap",
  "answer_incomplete",
]);

const dynamicOpeningSchema = z.object({
  questionText: z.string().min(6).max(200),
  questionType: questionTypeSchema,
  topics: z.array(z.string().min(1)).max(4),
  expectedSignals: z.array(z.string().min(1)).max(6),
  reason: z.string().min(4).max(200),
});

const dynamicEvaluationSchema = z.object({
  shouldAdvance: z.boolean(),
  action: followUpActionSchema,
  assistantText: z.string().min(6).max(240),
  questionType: questionTypeSchema,
  topics: z.array(z.string().min(1)).max(4),
  expectedSignals: z.array(z.string().min(1)).max(6),
  detectedSignals: z.array(z.string()).max(8),
  missingSignals: z.array(z.string()).max(8),
  riskFlags: z.array(riskFlagSchema).max(4),
  scoreByDimension: z.object({
    clarity: z.number().min(0).max(100),
    depth: z.number().min(0).max(100),
    evidence: z.number().min(0).max(100),
    relevance: z.number().min(0).max(100),
  }),
  confidence: z.number().min(0).max(1),
  finalComment: z.string().min(4).max(240),
  reason: z.string().min(4).max(200),
});

function createDynamicQuestion(args: {
  questionText: string;
  questionType?: QuestionType;
  topics?: string[];
  expectedSignals?: string[];
  questionId?: string;
}): InterviewPlanQuestion {
  return {
    questionId: args.questionId ?? `dynamic-${crypto.randomUUID()}`,
    questionText: args.questionText.trim(),
    questionType: args.questionType ?? "project",
    topics: args.topics?.filter(Boolean).slice(0, 4) ?? [],
    expectedSignals: args.expectedSignals?.filter(Boolean).slice(0, 6) ?? [],
    followUpTemplates: {},
    score: 0,
  };
}

function buildInterviewRoleLabel(profile: any) {
  return profile?.job_intention?.trim() || "技术岗位";
}

function buildSelfIntroductionOpening(profile: any) {
  return SELF_INTRO_OPENING_TEMPLATE.replace(
    "{role}",
    buildInterviewRoleLabel(profile),
  );
}

function formatProfileSummary(profile: any) {
  return [
    profile?.job_intention ? `目标岗位：${profile.job_intention}` : null,
    profile?.company_intention
      ? `目标公司：${profile.company_intention}`
      : null,
    profile?.experience_years !== undefined
      ? `经验年限：${profile.experience_years}`
      : null,
    Array.isArray(profile?.skills) && profile.skills.length
      ? `技能：${profile.skills.join("、")}`
      : null,
    profile?.bio ? `候选人简介：${profile.bio}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatRecentConversation(messages: RecentConversationMessage[]) {
  const merged = messages.slice(-6);
  if (!merged.length) {
    return "暂无历史对话";
  }

  return merged
    .map((item) => {
      const role = item.role === "assistant" ? "面试官" : "候选人";
      return `${role}：${item.content}`;
    })
    .join("\n");
}

function hasAnyUserMessage(messages: RecentConversationMessage[]) {
  return messages.some(
    (item) =>
      item.role === "user" &&
      typeof item.content === "string" &&
      item.content.trim().length > 0,
  );
}

export async function loadRecentConversationMessages(interviewId: string) {
  const messages = await interviewDataAccess.loadInterviewMessages(interviewId);
  return messages
    .filter(
      (item) =>
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim().length > 0,
    )
    .map((item) => ({
      role: item.role as "user" | "assistant",
      content: item.content.trim(),
      created_at:
        typeof item.created_at === "string" ? item.created_at : undefined,
    }));
}

async function loadQuestionReferences(profile: any) {
  const candidateProfile = buildCandidateProfile({
    job_intention: profile?.job_intention,
    experience_years: profile?.experience_years,
    company_intention: profile?.company_intention,
    skills: profile?.skills,
  });

  let questionAssets = await loadQuestionAssets({
    roleFamily: candidateProfile.roleFamily,
    seniority: candidateProfile.seniority,
    companyTag: profile?.company_intention || undefined,
    limit: 4,
  });

  if (!questionAssets.length) {
    questionAssets = await loadQuestionAssets({
      roleFamily: candidateProfile.roleFamily,
      seniority: candidateProfile.seniority,
      limit: 4,
    });
  }

  return questionAssets;
}

function buildOpeningFallback(profile: any): DynamicOpeningResult {
  const questionText = buildSelfIntroductionOpening(profile);
  const question = createDynamicQuestion({
    questionText,
    questionType: "project",
    topics: ["自我介绍", "项目经历"],
    expectedSignals: ["背景清晰", "职责明确", "结果量化"],
  });

  return {
    question,
    index: 0,
    decision: {
      action: "switch_topic",
      reason: "题库为空，退化为基于候选人背景的开场主问题。",
      shouldAdvance: true,
      nextQuestionId: question.questionId,
      questionText,
    },
  };
}

function buildEvaluationFallback(args: {
  questionId: string;
  questionText: string;
  answer: string;
}): DynamicEvaluationResult {
  const answer = args.answer.trim();
  const shouldAdvance = answer.length >= 80;
  const assistantText = shouldAdvance
    ? "明白了。接下来我想继续往实现细节里走，你具体讲一下当时最关键的技术决策，以及为什么这么选？"
    : "我先追问一个点：别再泛泛而谈，直接说你亲自负责的部分、怎么做、结果如何。";
  const nextQuestionId = shouldAdvance
    ? `dynamic-${crypto.randomUUID()}`
    : args.questionId;

  const currentQuestion = createDynamicQuestion({
    questionId: args.questionId,
    questionText: args.questionText,
    questionType: "project",
    topics: ["项目经历"],
    expectedSignals: ["职责明确", "实现细节", "结果量化"],
  });

  const trace: EvaluationTrace = {
    questionId: currentQuestion.questionId,
    questionType: currentQuestion.questionType,
    expectedSignals: currentQuestion.expectedSignals,
    candidateAnswerSpan: [answer.slice(0, 120)],
    detectedSignals: answer.length >= 40 ? ["给出了一定背景信息"] : [],
    missingSignals:
      answer.length >= 80 ? ["关键技术取舍"] : ["职责不清", "缺少结果量化"],
    riskFlags: answer.length >= 80 ? [] : (["answer_incomplete"] as RiskFlag[]),
    followUpReason: shouldAdvance
      ? "回答已有基础信息，可以继续深挖实现细节。"
      : "回答过短，先要求补足关键事实。",
    scoreByDimension: {
      clarity: shouldAdvance ? 72 : 45,
      depth: shouldAdvance ? 68 : 40,
      evidence: shouldAdvance ? 66 : 35,
      relevance: shouldAdvance ? 75 : 58,
    },
    finalComment: shouldAdvance
      ? "回答能建立基本背景，但还需要更多实现和结果细节。"
      : "回答明显不够具体，需要先补足职责、做法和结果。",
    confidence: 0.58,
  };

  const overallScore = Math.round(
    Object.values(trace.scoreByDimension).reduce(
      (sum, value) => sum + value,
      0,
    ) / Object.keys(trace.scoreByDimension).length,
  );

  return {
    currentQuestion,
    decision: {
      action: shouldAdvance ? "drill_down" : "ask_example",
      reason: trace.followUpReason,
      shouldAdvance,
      nextQuestionId,
      questionText: assistantText,
    },
    trace,
    overallScore,
    nextQuestion: {
      questionId: nextQuestionId,
      questionText: assistantText,
    },
  };
}

export async function loadExistingInterviewPlan(interviewId: string) {
  const plan = await loadInterviewPlan(interviewId);
  if (!plan?.questions?.length) {
    return null;
  }
  return plan;
}

export async function generateDynamicInterviewOpening(args: {
  interviewId: string;
  profile: any;
  recentMessages?: RecentConversationMessage[];
}): Promise<DynamicOpeningResult> {
  const recentMessages =
    args.recentMessages ??
    (await loadRecentConversationMessages(args.interviewId));

  if (!hasAnyUserMessage(recentMessages)) {
    const questionText = buildSelfIntroductionOpening(args.profile);
    const question = createDynamicQuestion({
      questionText,
      questionType: "project",
      topics: ["自我介绍", "项目经历"],
      expectedSignals: ["背景清晰", "职责明确", "项目概览"],
    });

    return {
      question,
      index: 0,
      decision: {
        action: "switch_topic",
        reason: "当前 interviewId 下用户尚未发言，先固定引导自我介绍。",
        shouldAdvance: true,
        nextQuestionId: question.questionId,
        questionText,
      },
    };
  }

  const llmConfig = validateLlmConfig();
  if (!llmConfig.isValid) {
    return buildOpeningFallback(args.profile);
  }

  try {
    const references = await loadQuestionReferences(args.profile);
    const model = createLangChainChatModelForUseCase({
      useCase: "interview-core",
      temperature: 0.35,
      maxTokens: 1200,
    }).withStructuredOutput(dynamicOpeningSchema, {
      method: "functionCalling",
    });

    const result = await model.invoke([
      {
        role: "system",
        content: [
          "你是一位中文技术面试官，正在做实时模拟面试。",
          "只决定当前这一轮应该问的第一句话，不要规划整场面试，不要输出题单。",
          "问题要像真人面试官开场，简洁、自然、只有一个问题。",
          "如果题库参考为空，也必须仅基于候选人背景给出有效问题。",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `interviewId=${args.interviewId}`,
          "## 候选人背景",
          formatProfileSummary(args.profile) || "暂无结构化背景",
          "",
          "## 最近对话",
          formatRecentConversation(recentMessages),
          "",
          "## 题库参考（仅作 few-shot，不是硬约束）",
          references.length
            ? references
                .map(
                  (item) =>
                    `- [${item.questionType}] ${item.questionText}（考点：${item.topics.join("、")}）`,
                )
                .join("\n")
            : "无",
          "",
          "现在请只返回开场主问题。",
        ].join("\n"),
      },
    ]);

    const question = createDynamicQuestion({
      questionText: result.questionText,
      questionType: result.questionType,
      topics: result.topics,
      expectedSignals: result.expectedSignals,
    });

    return {
      question,
      index: 0,
      decision: {
        action: "switch_topic",
        reason: result.reason,
        shouldAdvance: true,
        nextQuestionId: question.questionId,
        questionText: question.questionText,
      },
    };
  } catch (error) {
    console.error("[interview-rag] dynamic opening failed, fallback", error);
    return buildOpeningFallback(args.profile);
  }
}

export async function generateDynamicInterviewEvaluation(args: {
  interviewId: string;
  profile: any;
  questionId: string;
  questionText: string;
  answer: string;
}): Promise<DynamicEvaluationResult> {
  const recentMessages = await loadRecentConversationMessages(args.interviewId);
  const llmConfig = validateLlmConfig();
  if (!llmConfig.isValid) {
    return buildEvaluationFallback(args);
  }

  try {
    const references = await loadQuestionReferences(args.profile);
    const model = createLangChainChatModelForUseCase({
      useCase: "interview-core",
      temperature: 0.25,
      maxTokens: 1800,
    }).withStructuredOutput(dynamicEvaluationSchema, {
      method: "functionCalling",
    });

    const result = await model.invoke([
      {
        role: "system",
        content: [
          "你是一位中文技术面试官，正在进行实时面试。",
          "你的任务只有两个：先评估候选人对当前问题的回答质量，再决定你下一句具体要说什么。",
          "不要规划后续整场面试，不要一次问多个问题。",
          "如果回答不足，优先追问一个最关键的缺口；如果回答已经到位，再切到下一个单点问题。",
          "assistantText 必须是你下一句真的会说出口的话。",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          `interviewId=${args.interviewId}`,
          "## 候选人背景",
          formatProfileSummary(args.profile) || "暂无结构化背景",
          "",
          "## 最近对话",
          formatRecentConversation(recentMessages),
          "",
          "## 当前正在评估的问题",
          args.questionText,
          "",
          "## 候选人本轮回答",
          args.answer,
          "",
          "## 题库参考（仅作 few-shot，不是硬约束）",
          references.length
            ? references
                .map(
                  (item) =>
                    `- [${item.questionType}] ${item.questionText}（考点：${item.topics.join("、")}）`,
                )
                .join("\n")
            : "无",
          "",
          "请输出当前回答的评分与下一句面试官话术。",
        ].join("\n"),
      },
    ]);

    const currentQuestion = createDynamicQuestion({
      questionId: args.questionId,
      questionText: args.questionText,
      questionType: result.questionType,
      topics: result.topics,
      expectedSignals: result.expectedSignals,
    });
    const nextQuestionId = result.shouldAdvance
      ? `dynamic-${crypto.randomUUID()}`
      : currentQuestion.questionId;

    const trace: EvaluationTrace = {
      questionId: currentQuestion.questionId,
      questionType: currentQuestion.questionType,
      expectedSignals: result.expectedSignals,
      candidateAnswerSpan: [args.answer.slice(0, 200)],
      detectedSignals: result.detectedSignals,
      missingSignals: result.missingSignals,
      riskFlags: result.riskFlags as RiskFlag[],
      followUpReason: result.reason,
      scoreByDimension: result.scoreByDimension,
      finalComment: result.finalComment,
      confidence: result.confidence,
    };

    const overallScore = Math.round(
      Object.values(trace.scoreByDimension).reduce(
        (sum, value) => sum + value,
        0,
      ) / Object.keys(trace.scoreByDimension).length,
    );

    return {
      currentQuestion,
      decision: {
        action: result.action,
        reason: result.reason,
        shouldAdvance: result.shouldAdvance,
        nextQuestionId,
        questionText: result.assistantText,
      },
      trace,
      overallScore,
      nextQuestion: {
        questionId: nextQuestionId,
        questionText: result.assistantText,
      },
    };
  } catch (error) {
    console.error("[interview-rag] dynamic evaluation failed, fallback", error);
    return buildEvaluationFallback(args);
  }
}

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

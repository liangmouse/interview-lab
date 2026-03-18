import type {
  AnswerSignalAnalysis,
  CandidateProfile,
  EvaluationTrace,
  FollowUpDecision,
  InterviewPlan,
  InterviewPlanQuestion,
  InterviewerProfile,
  MasteryLevel,
  QuestionAsset,
  RiskFlag,
  RoleFamily,
  Seniority,
} from "@interviewclaw/domain";

type PlannerInput = {
  interviewId: string;
  profile: {
    job_intention?: string | null;
    experience_years?: number | null;
    company_intention?: string | null;
    skills?: string[] | null;
  };
  questionAssets: QuestionAsset[];
  interviewerProfile?: InterviewerProfile | null;
  limit?: number;
};

type AnalyzeAnswerArgs = {
  answer: string;
  question: Pick<
    InterviewPlanQuestion,
    "questionText" | "expectedSignals" | "questionType" | "topics"
  >;
};

type DecideFollowUpArgs = {
  plan: InterviewPlan;
  currentQuestion: InterviewPlanQuestion;
  currentIndex: number;
  analysis: AnswerSignalAnalysis;
};

type BuildEvaluationArgs = {
  answer: string;
  question: InterviewPlanQuestion;
  analysis: AnswerSignalAnalysis;
  decision: FollowUpDecision;
};

const ROLE_KEYWORDS: Array<{ role: RoleFamily; keywords: string[] }> = [
  {
    role: "frontend",
    keywords: ["frontend", "前端", "react", "vue", "浏览器"],
  },
  {
    role: "backend",
    keywords: ["backend", "后端", "java", "go", "数据库", "服务端"],
  },
  {
    role: "mobile",
    keywords: ["mobile", "ios", "android", "rn", "flutter", "客户端"],
  },
  { role: "ai", keywords: ["ai", "llm", "machine learning", "模型", "rag"] },
  { role: "data", keywords: ["data", "数据", "数仓", "etl", "bi"] },
  { role: "infra", keywords: ["infra", "devops", "k8s", "云原生", "运维"] },
  { role: "fullstack", keywords: ["fullstack", "全栈"] },
];

function inferRoleFamily(
  jobIntention?: string | null,
  skills?: string[],
): RoleFamily {
  const haystack =
    `${jobIntention || ""} ${(skills || []).join(" ")}`.toLowerCase();
  const matched = ROLE_KEYWORDS.find(({ keywords }) =>
    keywords.some((keyword) => haystack.includes(keyword)),
  );
  return matched?.role || "general";
}

function inferSeniority(
  experienceYears?: number | null,
  jobIntention?: string | null,
): Seniority {
  if ((jobIntention || "").includes("校招") || (experienceYears || 0) <= 0) {
    return "campus";
  }
  if ((experienceYears || 0) <= 2) return "junior";
  if ((experienceYears || 0) <= 5) return "mid";
  if ((experienceYears || 0) <= 8) return "senior";
  return "expert";
}

export function buildCandidateProfile(
  input: PlannerInput["profile"],
): CandidateProfile {
  const skills = Array.isArray(input.skills)
    ? input.skills.filter(Boolean)
    : [];
  return {
    roleFamily: inferRoleFamily(input.job_intention, skills),
    seniority: inferSeniority(input.experience_years, input.job_intention),
    experienceYears: Math.max(0, Number(input.experience_years || 0)),
    targetCompany: input.company_intention || undefined,
    targetRole: input.job_intention || undefined,
    skills,
  };
}

function computeQuestionScore(
  question: QuestionAsset,
  profile: CandidateProfile,
  interviewerProfile?: InterviewerProfile | null,
): number {
  let score = question.qualityScore * 100;

  if (question.roleFamily === profile.roleFamily) score += 40;
  if (question.roleFamily === "general") score += 10;
  if (question.seniority === profile.seniority) score += 30;
  if (profile.targetCompany && question.companyTag === profile.targetCompany)
    score += 15;

  const loweredText = question.questionText.toLowerCase();
  const skillHits = profile.skills.filter((skill) =>
    loweredText.includes(skill.toLowerCase()),
  ).length;
  score += skillHits * 8;

  if (interviewerProfile) {
    if (question.questionType === "algorithm")
      score += interviewerProfile.algorithmWeight * 2;
    if (question.questionType === "project")
      score += interviewerProfile.projectWeight * 2;
    if (question.questionType === "behavioral")
      score += interviewerProfile.behaviorWeight * 2;
    score +=
      interviewerProfile.depthPreference * Math.min(question.difficulty, 5);
  }

  return score;
}

export function createInterviewPlan(input: PlannerInput): InterviewPlan {
  const candidateProfile = buildCandidateProfile(input.profile);
  const limit = input.limit ?? 10;

  const selected = [...input.questionAssets]
    .map((question) => ({
      question,
      score: computeQuestionScore(
        question,
        candidateProfile,
        input.interviewerProfile,
      ),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  const questions: InterviewPlanQuestion[] = selected.map(
    ({ question, score }) => ({
      questionId: question.id,
      questionText: question.questionText,
      questionType: question.questionType,
      topics: question.topics,
      expectedSignals: question.expectedSignals,
      followUpTemplates: question.followUpTemplates,
      score,
    }),
  );

  const plannedTopics = Array.from(
    new Set(questions.flatMap((question) => question.topics)),
  );

  return {
    id: `plan:${input.interviewId}`,
    interviewId: input.interviewId,
    summary: `基于 ${candidateProfile.roleFamily} / ${candidateProfile.seniority} 生成 ${questions.length} 道候选题`,
    candidateProfile,
    interviewerProfileId: input.interviewerProfile?.id,
    plannedTopics,
    questions,
    createdAt: new Date().toISOString(),
  };
}

function extractRiskFlags(
  answer: string,
  specificity: number,
  expectedSignals: string[],
): RiskFlag[] {
  const flags = new Set<RiskFlag>();

  if (answer.trim().length < 30) {
    flags.add("answer_incomplete");
    flags.add("vague_answer");
  }
  if (specificity < 0.35) {
    flags.add("vague_answer");
  }
  if (!/\d+[%ms天月年wWkK]/.test(answer)) {
    flags.add("low_metric_detail");
  }
  if (!/(例如|比如|一次|当时|项目|上线|场景)/.test(answer)) {
    flags.add("no_example");
  }
  if (!/(负责|主导|实现|排查|设计|优化)/.test(answer)) {
    flags.add("role_unclear");
  }
  if (
    (expectedSignals.some((signal) => /原理|机制|底层|执行时机/.test(signal)) ||
      specificity < 0.5) &&
    (!/(原理|因为|底层|机制|依赖数组|执行时机)/.test(answer) ||
      /(没有深入研究|不太清楚|没继续看|不了解原因)/.test(answer))
  ) {
    flags.add("principle_gap");
  }
  if (/(这个很简单|都差不多|网上都有)/.test(answer)) {
    flags.add("possible_bluffing");
  }

  return Array.from(flags);
}

function inferMasteryLevel(
  completeness: number,
  specificity: number,
  riskFlags: RiskFlag[],
): MasteryLevel {
  if (completeness < 0.3) return "unknown";
  if (
    riskFlags.includes("possible_bluffing") ||
    riskFlags.includes("principle_gap")
  ) {
    return "memorized";
  }
  if (specificity >= 0.7 && completeness >= 0.75) {
    return "deep";
  }
  if (specificity >= 0.45) {
    return "applied";
  }
  return "memorized";
}

export function analyzeAnswer(args: AnalyzeAnswerArgs): AnswerSignalAnalysis {
  const answer = args.answer.trim();
  const expectedSignals = args.question.expectedSignals || [];
  const sentences = answer
    .split(/[。！？!?]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const whitespaceTokens = answer.split(/\s+/).filter(Boolean).length;
  const compactLength = answer.replace(/\s+/g, "").length;
  const tokenCount = Math.max(whitespaceTokens, Math.round(compactLength / 2));
  const evidenceSignals = expectedSignals.filter((signal) =>
    answer.toLowerCase().includes(signal.toLowerCase()),
  );
  const completeness = Math.min(1, tokenCount / 90);
  const specificitySignals = [
    /\d+[%ms天月年wWkK]/.test(answer),
    /(例如|比如|当时|线上|故障|压测|复盘)/.test(answer),
    /(因为|所以|权衡|取舍|原因)/.test(answer),
    /(负责|主导|实现|排查|优化|设计)/.test(answer),
  ].filter(Boolean).length;
  const specificity = Math.min(1, specificitySignals / 4);
  const correctnessConfidence = Math.min(
    1,
    0.35 + evidenceSignals.length * 0.15 + (sentences.length >= 2 ? 0.1 : 0),
  );
  const missingSignals = expectedSignals.filter(
    (signal) => !evidenceSignals.includes(signal),
  );
  const riskFlags = extractRiskFlags(answer, specificity, expectedSignals);
  const masteryEstimate = inferMasteryLevel(
    completeness,
    specificity,
    riskFlags,
  );

  return {
    answered: answer.length > 0,
    completeness,
    specificity,
    correctnessConfidence,
    evidenceSignals,
    missingSignals,
    riskFlags,
    masteryEstimate,
    notes: [
      `sentences=${sentences.length}`,
      `tokenCount=${tokenCount}`,
      `expectedSignalsMatched=${evidenceSignals.length}`,
    ],
  };
}

export function decideFollowUp(args: DecideFollowUpArgs): FollowUpDecision {
  const { plan, currentQuestion, currentIndex, analysis } = args;
  const nextMainQuestion = plan.questions[currentIndex + 1];

  if (!analysis.answered || analysis.completeness < 0.25) {
    return {
      action: "ask_example",
      reason: "回答不完整，先要求补充具体场景。",
      shouldAdvance: false,
      questionText:
        currentQuestion.followUpTemplates.ask_example?.[0] ||
        "请结合一个具体场景或项目例子，把刚才的回答展开说明。",
    };
  }

  if (analysis.riskFlags.includes("principle_gap")) {
    return {
      action: "ask_principle",
      reason: "回答里缺少原理层解释，需要验证是否只是背诵。",
      shouldAdvance: false,
      questionText:
        currentQuestion.followUpTemplates.ask_principle?.[0] ||
        "你刚才提到的是结论层，能继续解释一下背后的原理和关键机制吗？",
    };
  }

  if (
    analysis.riskFlags.includes("no_example") ||
    analysis.riskFlags.includes("role_unclear")
  ) {
    return {
      action: "cross_check",
      reason: "缺少个人贡献与场景细节，需要交叉验证真实性。",
      shouldAdvance: false,
      questionText:
        currentQuestion.followUpTemplates.cross_check?.[0] ||
        "把你个人负责的部分单独拎出来讲一下：当时你具体做了什么，结果如何？",
    };
  }

  if (
    analysis.masteryEstimate === "deep" &&
    analysis.correctnessConfidence >= 0.7
  ) {
    return {
      action: "raise_difficulty",
      reason: "当前主题回答较扎实，继续下压深度。",
      shouldAdvance: false,
      questionText:
        currentQuestion.followUpTemplates.drill_down?.[0] ||
        "如果把流量和数据规模放大 10 倍，你会先重构哪一层，为什么？",
    };
  }

  return {
    action: "switch_topic",
    reason: nextMainQuestion
      ? "当前题已获得足够信号，切换到下一主题覆盖更多能力。"
      : "计划题已接近结束。",
    shouldAdvance: true,
    nextQuestionId: nextMainQuestion?.questionId,
    questionText:
      nextMainQuestion?.questionText ||
      "今天的问题差不多到这里了，最后请你总结一下自己最有代表性的技术优势。",
  };
}

export function buildEvaluationTrace(
  args: BuildEvaluationArgs,
): EvaluationTrace {
  const { answer, question, analysis, decision } = args;
  const scoreByDimension = {
    completeness: Math.round(analysis.completeness * 100),
    specificity: Math.round(analysis.specificity * 100),
    correctness: Math.round(analysis.correctnessConfidence * 100),
    authenticity:
      100 -
      Math.min(
        80,
        analysis.riskFlags.length * 18 +
          (analysis.riskFlags.includes("possible_bluffing") ? 20 : 0),
      ),
  };
  const avg =
    Object.values(scoreByDimension).reduce((sum, value) => sum + value, 0) /
    Object.keys(scoreByDimension).length;

  return {
    questionId: question.questionId,
    questionType: question.questionType,
    expectedSignals: question.expectedSignals,
    candidateAnswerSpan: [answer.slice(0, 400)],
    detectedSignals: analysis.evidenceSignals,
    missingSignals: analysis.missingSignals,
    riskFlags: analysis.riskFlags,
    followUpReason: decision.reason,
    scoreByDimension,
    finalComment: `综合得分 ${Math.round(avg)}，能力判断为 ${analysis.masteryEstimate}。`,
    confidence: Number(analysis.correctnessConfidence.toFixed(2)),
  };
}

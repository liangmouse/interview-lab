import {
  analyzeAnswer,
  buildCandidateProfile,
  createInterviewPlan,
  decideFollowUp,
} from "@interviewclaw/agent-core";
import type {
  AnswerSignalAnalysis,
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

type OrchestratorInit = {
  interviewId: string;
  userProfile: any;
};

type TurnResult = {
  question: InterviewPlanQuestion;
  analysis: AnswerSignalAnalysis | null;
  decision: FollowUpDecision;
};

export class InterviewOrchestrator {
  private readonly interviewId: string;
  private readonly userProfile: any;
  private plan: InterviewPlan | null = null;
  private currentIndex = 0;

  constructor(args: OrchestratorInit) {
    this.interviewId = args.interviewId;
    this.userProfile = args.userProfile;
  }

  async ensureReady() {
    if (this.plan) return this.plan;

    const existing = await loadInterviewPlan(this.interviewId);
    if (existing) {
      this.plan = existing;
      return existing;
    }

    const candidateProfile = buildCandidateProfile({
      job_intention: this.userProfile?.job_intention,
      experience_years: this.userProfile?.experience_years,
      company_intention: this.userProfile?.company_intention,
      skills: this.userProfile?.skills,
    });

    let questionAssets = await loadQuestionAssets({
      roleFamily: candidateProfile.roleFamily,
      seniority: candidateProfile.seniority,
      companyTag: candidateProfile.targetCompany,
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
      companyTag: candidateProfile.targetCompany,
      roleFamily: candidateProfile.roleFamily,
    });

    const plan = createInterviewPlan({
      interviewId: this.interviewId,
      profile: {
        job_intention: this.userProfile?.job_intention,
        experience_years: this.userProfile?.experience_years,
        company_intention: this.userProfile?.company_intention,
        skills: this.userProfile?.skills,
      },
      questionAssets,
      interviewerProfile,
      limit: 10,
    });
    await upsertInterviewPlan(plan);
    this.plan = plan;
    return plan;
  }

  async getPromptContext() {
    const plan = await this.ensureReady();
    return [
      `plan_summary: ${plan.summary}`,
      `planned_topics: ${plan.plannedTopics.join(", ")}`,
      `current_question: ${plan.questions[this.currentIndex]?.questionText || "N/A"}`,
    ].join("\n");
  }

  async start(): Promise<TurnResult> {
    const plan = await this.ensureReady();
    const question = plan.questions[this.currentIndex];

    return {
      question,
      analysis: null,
      decision: {
        action: "switch_topic",
        reason: "开始当前计划中的第一道主问题。",
        shouldAdvance: true,
        nextQuestionId: question?.questionId,
        questionText: question?.questionText || "请先做一个简短的自我介绍。",
      },
    };
  }

  async continue(answer: string): Promise<TurnResult> {
    const plan = await this.ensureReady();
    const question = plan.questions[this.currentIndex];
    if (!question) {
      return this.start();
    }

    const analysis = analyzeAnswer({
      answer,
      question,
    });
    const decision = decideFollowUp({
      plan,
      currentQuestion: question,
      currentIndex: this.currentIndex,
      analysis,
    });

    await this.persistArtifacts(question, analysis, decision, plan);

    if (decision.shouldAdvance && plan.questions[this.currentIndex + 1]) {
      this.currentIndex += 1;
    }

    const currentQuestion = decision.shouldAdvance
      ? plan.questions[this.currentIndex]
      : question;

    return {
      question: currentQuestion,
      analysis,
      decision: {
        ...decision,
        questionText: currentQuestion?.questionText || decision.questionText,
      },
    };
  }

  private async persistArtifacts(
    question: InterviewPlanQuestion,
    analysis: AnswerSignalAnalysis,
    decision: FollowUpDecision,
    plan: InterviewPlan,
  ) {
    const turnId = `${Date.now()}`;
    const masteryByTopic = Object.fromEntries(
      question.topics.map((topic) => [topic, analysis.masteryEstimate]),
    );
    const coverageStatus = Object.fromEntries(
      plan.plannedTopics.map((topic) => [
        topic,
        question.topics.includes(topic)
          ? ("covered" as const)
          : ("pending" as const),
      ]),
    );

    await saveCandidateStateSnapshot({
      interviewId: this.interviewId,
      turnId,
      masteryByTopic,
      riskFlags: analysis.riskFlags,
      coverageStatus,
      recommendedNextAction: decision.action,
    });

    await saveInterviewDecision({
      interviewId: this.interviewId,
      turnId,
      selectedQuestionId: question.questionId,
      retrievalEvidence: [
        `topics=${question.topics.join(",")}`,
        `expected_signals=${question.expectedSignals.join(",")}`,
        `mastery=${analysis.masteryEstimate}`,
      ],
      decisionType: decision.shouldAdvance ? "main_question" : decision.action,
      decisionReason: decision.reason,
      alternativeCandidates: plan.questions
        .slice(this.currentIndex + 1, this.currentIndex + 4)
        .map((item) => item.questionId),
    });
  }
}

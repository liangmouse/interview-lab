import { z } from "zod";
import {
  createLangChainChatModelForUseCase,
  createLangChainChatModel,
  mergeLangfuseTracingContext,
  type LangfuseTracingContext,
} from "@interviewclaw/ai-runtime";
import {
  claimNextQuestioningJob,
  completeQuestioningJob,
  failQuestioningJob,
  loadInterviewerProfile,
  loadQuestionAssets,
} from "@interviewclaw/data-access";
import {
  buildCandidateProfile,
  createInterviewPlan,
} from "@interviewclaw/agent-core";
import type { QuestioningReport } from "@interviewclaw/domain";
import {
  buildJobTracingContext,
  ensureResumeSnapshot,
  getCapabilityModelInfo,
} from "./shared";

const questioningSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()).min(3).max(8),
  questions: z.array(
    z.object({
      questionId: z.string(),
      reason: z.string(),
      preparationAdvice: z.string(),
    }),
  ),
});

async function generateQuestioningReport(args: {
  targetRole: string;
  track: "social" | "campus";
  targetCompany?: string;
  jobDescription?: string;
  plan: ReturnType<typeof createInterviewPlan>;
  tracing?: LangfuseTracingContext;
}) {
  const tracing = mergeLangfuseTracingContext(
    {
      traceName: "questioning-job",
      generationName: "questioning-report-generation",
      tags: ["questioning", "llm-apps"],
      metadata: {
        targetRole: args.targetRole,
        track: args.track,
        questionCount: args.plan.questions.length,
        hasTargetCompany: !!args.targetCompany,
        hasJobDescription: !!args.jobDescription?.trim(),
      },
    },
    args.tracing,
  );
  const explicitModel = process.env.QUESTIONING_MODEL?.trim();
  const model = (
    explicitModel
      ? createLangChainChatModel({
          model: explicitModel,
          temperature: 0.3,
          maxTokens: 5000,
          tracing,
        })
      : createLangChainChatModelForUseCase({
          useCase: "question-predict",
          temperature: 0.3,
          maxTokens: 5000,
          tracing,
        })
  ).withStructuredOutput(questioningSchema);

  return model.invoke([
    {
      role: "system",
      content:
        "你是一位资深技术面试教练。请基于给定题单生成中文押题报告，结论务必紧扣题目，不要新增不存在的题目。",
    },
    {
      role: "user",
      content: [
        `目标岗位：${args.targetRole}`,
        `求职赛道：${args.track === "social" ? "社招" : "校招"}`,
        args.targetCompany
          ? `目标公司：${args.targetCompany}`
          : "未指定目标公司",
        args.jobDescription?.trim()
          ? `目标 JD：${args.jobDescription.trim()}`
          : "未提供目标 JD。",
        `候选题单：${JSON.stringify(args.plan.questions)}`,
        "请输出：整体总结、3-8 个高优先级提醒、每道题的入选理由与准备建议。",
      ].join("\n\n"),
    },
  ]);
}

export async function runOneQuestioningJob() {
  const claimStartedAt = Date.now();
  const job = await claimNextQuestioningJob();
  if (!job) {
    return null;
  }
  console.info("[questioning-worker] claimed job", {
    jobId: job.id,
    userId: job.userId,
    claimDurationMs: Date.now() - claimStartedAt,
    createdAt: job.createdAt,
  });

  const { providerId, model } = getCapabilityModelInfo({
    envModelKey: "QUESTIONING_MODEL",
    useCase: "question-predict",
  });
  const jobStartedAt = Date.now();
  const tracing = buildJobTracingContext({
    userId: job.userId,
    jobId: job.id,
    jobType: "questioning",
    resumeStoragePath: job.payload.resumeStoragePath,
    metadata: {
      targetRole: job.payload.targetRole,
      track: job.payload.track,
      targetCompany: job.payload.targetCompany,
    },
  });

  try {
    const snapshotStartedAt = Date.now();
    const { snapshot } = await ensureResumeSnapshot(
      job.userId,
      job.payload.resumeStoragePath,
      tracing,
    );
    console.info("[questioning-worker] resume snapshot ready", {
      jobId: job.id,
      durationMs: Date.now() - snapshotStartedAt,
      skillCount: snapshot.skills?.length ?? 0,
    });

    const profileInput = {
      job_intention:
        job.payload.targetRole || snapshot.jobIntention || "通用软件工程岗位",
      experience_years:
        snapshot.experienceYears ??
        (job.payload.track === "campus"
          ? 0
          : Number.parseInt(job.payload.workExperience || "0", 10) || 0),
      company_intention: job.payload.targetCompany,
      skills: snapshot.skills ?? [],
    };

    const candidateProfile = buildCandidateProfile(profileInput);

    const retrievalStartedAt = Date.now();
    let questionAssets = await loadQuestionAssets({
      roleFamily: candidateProfile.roleFamily,
      seniority: candidateProfile.seniority,
      companyTag: job.payload.targetCompany || undefined,
      limit: 20,
    });

    if (questionAssets.length === 0) {
      questionAssets = await loadQuestionAssets({ limit: 20 });
    }

    const interviewerProfile = await loadInterviewerProfile({
      roleFamily: candidateProfile.roleFamily,
      companyTag: job.payload.targetCompany || undefined,
    });
    console.info("[questioning-worker] retrieval completed", {
      jobId: job.id,
      durationMs: Date.now() - retrievalStartedAt,
      questionAssetCount: questionAssets.length,
      hasInterviewerProfile: !!interviewerProfile,
    });

    const plan = createInterviewPlan({
      interviewId: job.id,
      profile: profileInput,
      questionAssets,
      interviewerProfile,
      limit: 6,
    });
    console.info("[questioning-worker] plan created", {
      jobId: job.id,
      questionCount: plan.questions.length,
    });

    const generationStartedAt = Date.now();
    const generated = await generateQuestioningReport({
      targetRole: job.payload.targetRole,
      track: job.payload.track,
      targetCompany: job.payload.targetCompany,
      jobDescription: job.payload.jobDescription,
      plan,
      tracing,
    });
    console.info("[questioning-worker] llm generation completed", {
      jobId: job.id,
      durationMs: Date.now() - generationStartedAt,
      highlightCount: generated.highlights.length,
      generatedQuestionCount: generated.questions.length,
      providerId,
      model,
    });

    const questions = plan.questions.map((question) => {
      const generatedQuestion = generated.questions.find(
        (item) => item.questionId === question.questionId,
      );
      return {
        questionId: question.questionId,
        questionText: question.questionText,
        questionType: question.questionType,
        topics: question.topics,
        expectedSignals: question.expectedSignals,
        reason:
          generatedQuestion?.reason ||
          `这道题覆盖了 ${question.topics.join("、")} 等高频考点。`,
        preparationAdvice:
          generatedQuestion?.preparationAdvice ||
          "整理项目案例、关键指标和底层原理，按 STAR 结构准备回答。",
      };
    });

    const result: QuestioningReport = {
      id: job.id,
      title: `${job.payload.targetRole} 押题报告`,
      targetRole: job.payload.targetRole,
      track: job.payload.track,
      createdAt: new Date().toISOString(),
      highlights: generated.highlights,
      summary: generated.summary,
      questions,
    };

    await completeQuestioningJob({
      jobId: job.id,
      providerId,
      model,
      result,
    });
    console.info("[questioning-worker] job completed", {
      jobId: job.id,
      totalDurationMs: Date.now() - jobStartedAt,
    });

    return job.id;
  } catch (error) {
    console.error("[questioning-worker] job failed", {
      jobId: job.id,
      totalDurationMs: Date.now() - jobStartedAt,
      message: error instanceof Error ? error.message : "押题任务失败",
    });
    await failQuestioningJob({
      jobId: job.id,
      errorMessage: error instanceof Error ? error.message : "押题任务失败",
      providerId,
      model,
    });
    return job.id;
  }
}

import { z } from "zod";
import {
  createLangChainChatModelForUseCase,
  createLangChainChatModel,
  mergeLangfuseTracingContext,
  type LangfuseTracingContext,
} from "@interviewclaw/ai-runtime";
import {
  claimNextResumeReviewJob,
  completeResumeReviewJob,
  failResumeReviewJob,
} from "@interviewclaw/data-access";
import type { ResumeReviewResult } from "@interviewclaw/domain";
import {
  buildJobTracingContext,
  ensureResumeSnapshot,
  getCapabilityModelInfo,
} from "./shared";

const resumeReviewSchema = z.object({
  overallScore: z.number().min(0).max(100),
  overallAssessment: z.string(),
  sections: z.array(
    z.object({
      sectionName: z.string(),
      score: z.number().min(0).max(100),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      suggestions: z.array(
        z.object({
          original: z.string(),
          improved: z.string(),
          reason: z.string(),
        }),
      ),
    }),
  ),
  atsCompatibility: z.object({
    score: z.number().min(0).max(100),
    issues: z.array(z.string()),
    recommendations: z.array(z.string()),
  }),
  jdMatchAnalysis: z
    .object({
      matchScore: z.number().min(0).max(100),
      matchedKeywords: z.array(z.string()),
      missingKeywords: z.array(z.string()),
      recommendations: z.array(z.string()),
    })
    .optional(),
});

async function generateResumeReview(args: {
  resumeName: string;
  resumeText: string;
  snapshot: Record<string, unknown>;
  jobDescription?: string;
  tracing?: LangfuseTracingContext;
}) {
  const tracing = mergeLangfuseTracingContext(
    {
      traceName: "resume-review-job",
      generationName: "resume-review-generation",
      tags: ["resume-review", "llm-apps"],
      metadata: {
        resumeName: args.resumeName,
        textLength: args.resumeText.length,
        hasJobDescription: !!args.jobDescription?.trim(),
      },
    },
    args.tracing,
  );
  const explicitModel = process.env.RESUME_REVIEW_MODEL?.trim();
  const model = (
    explicitModel
      ? createLangChainChatModel({
          model: explicitModel,
          temperature: 0.2,
          maxTokens: 5000,
          tracing,
        })
      : createLangChainChatModelForUseCase({
          useCase: "report-generate",
          temperature: 0.2,
          maxTokens: 5000,
          tracing,
        })
  ).withStructuredOutput(resumeReviewSchema, {
    method: "functionCalling",
  });

  return model.invoke([
    {
      role: "system",
      content:
        "你是一位资深简历顾问。请用中文输出严格结构化的点评结果，评分要克制，建议要可执行，不要空话。",
    },
    {
      role: "user",
      content: [
        `简历文件名：${args.resumeName}`,
        `结构化简历快照：${JSON.stringify(args.snapshot)}`,
        `简历原文：${args.resumeText}`,
        args.jobDescription?.trim()
          ? `目标 JD：${args.jobDescription.trim()}`
          : "未提供目标 JD，请仅做通用简历点评。",
        "请重点评估：工作经历、项目经历、技能描述、教育背景、ATS 兼容性。",
      ].join("\n\n"),
    },
  ]);
}

export async function runOneResumeReviewJob() {
  const claimStartedAt = Date.now();
  const job = await claimNextResumeReviewJob();
  if (!job) {
    return null;
  }
  console.info("[resume-review-worker] claimed job", {
    jobId: job.id,
    userId: job.userId,
    claimDurationMs: Date.now() - claimStartedAt,
    createdAt: job.createdAt,
  });

  const { providerId, model } = getCapabilityModelInfo({
    envModelKey: "RESUME_REVIEW_MODEL",
    useCase: "report-generate",
  });
  const jobStartedAt = Date.now();
  const tracing = buildJobTracingContext({
    userId: job.userId,
    jobId: job.id,
    jobType: "resume-review",
    resumeStoragePath: job.payload.resumeStoragePath,
  });

  try {
    const snapshotStartedAt = Date.now();
    const { record, snapshot } = await ensureResumeSnapshot(
      job.userId,
      job.payload.resumeStoragePath,
      tracing,
    );
    console.info("[resume-review-worker] resume snapshot ready", {
      jobId: job.id,
      durationMs: Date.now() - snapshotStartedAt,
      hasParsedText: !!record.parsedText,
      resumeName: record.fileName,
    });
    const generationStartedAt = Date.now();
    const generated = await generateResumeReview({
      resumeName: record.fileName,
      resumeText: record.parsedText ?? "",
      snapshot,
      jobDescription: job.payload.jobDescription,
      tracing,
    });
    console.info("[resume-review-worker] llm generation completed", {
      jobId: job.id,
      durationMs: Date.now() - generationStartedAt,
      sectionCount: generated.sections.length,
      providerId,
      model,
    });

    const result: ResumeReviewResult = {
      id: job.id,
      resumeName: record.fileName,
      createdAt: new Date().toISOString(),
      overallScore: generated.overallScore,
      overallAssessment: generated.overallAssessment,
      sections: generated.sections,
      atsCompatibility: generated.atsCompatibility,
      ...(generated.jdMatchAnalysis
        ? { jdMatchAnalysis: generated.jdMatchAnalysis }
        : {}),
    };

    await completeResumeReviewJob({
      jobId: job.id,
      providerId,
      model,
      result,
    });
    console.info("[resume-review-worker] job completed", {
      jobId: job.id,
      totalDurationMs: Date.now() - jobStartedAt,
    });

    return job.id;
  } catch (error) {
    console.error("[resume-review-worker] job failed", {
      jobId: job.id,
      totalDurationMs: Date.now() - jobStartedAt,
      message: error instanceof Error ? error.message : "简历点评任务失败",
    });
    await failResumeReviewJob({
      jobId: job.id,
      errorMessage: error instanceof Error ? error.message : "简历点评任务失败",
      providerId,
      model,
    });
    return job.id;
  }
}

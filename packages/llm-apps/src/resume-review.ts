import { z } from "zod";
import {
  createOpenAIProvider,
  createLangChainChatModelForUseCase,
  createLangChainChatModel,
  mergeLangfuseTracingContext,
  type LangfuseTracingContext,
  resolveOpenAICompatibleProviderConfig,
} from "@interviewclaw/ai-runtime";
import {
  claimNextResumeReviewJob,
  completeResumeReviewJob,
  failResumeReviewJob,
} from "@interviewclaw/data-access";
import type {
  ResumeLayoutReview,
  ResumeReviewResult,
} from "@interviewclaw/domain";
import {
  buildJobTracingContext,
  ensureResumeSnapshot,
  getCapabilityModelInfo,
  type ResumeTextQualityReport,
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

const resumeLayoutReviewSchema = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  strengths: z.array(z.string()),
  issues: z.array(z.string()),
  suggestions: z.array(z.string()),
});

function extractJsonPayload(rawText: string) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("版式点评结果为空");
  }

  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("版式点评结果不是合法 JSON");
  }

  return withoutFence.slice(start, end + 1);
}

async function generateResumeLayoutReview(args: {
  resumeName: string;
  resumeFileUrl: string;
  targetRole: string;
  targetCompany: string;
  jobDescription?: string;
}): Promise<ResumeLayoutReview | null> {
  if (!args.resumeFileUrl.trim()) {
    return null;
  }

  let config;
  try {
    config = resolveOpenAICompatibleProviderConfig({
      providerId: "openai",
      defaultModel: process.env.RESUME_REVIEW_LAYOUT_MODEL?.trim() || "gpt-4.1",
    });
  } catch {
    return null;
  }

  try {
    const provider = createOpenAIProvider({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      headers: config.headers,
      id: config.providerId,
    });
    const client = provider.createOpenAIClient();
    const response = await client.responses.create({
      model: config.model,
      instructions: [
        "你是一位资深简历顾问，只负责评估简历 PDF 的版式与视觉可读性，不评估候选人经历内容本身。",
        "请重点判断：信息层级是否清晰、重点是否突出、留白与密度是否均衡、排版是否利于招聘者快速扫描、是否存在明显影响 ATS 或阅读体验的版式风险。",
        "不要臆造 OCR、字体嵌入、编码损坏、导出异常等问题；只有在 PDF 页面视觉上能直接观察到时才能指出。",
        "输出必须是 JSON 对象，字段固定为 score、summary、strengths、issues、suggestions。",
        "suggestions 只保留用户能直接执行的版式优化动作，最多 4 条。",
      ].join(" "),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `简历文件名：${args.resumeName}`,
                `目标岗位：${args.targetRole}`,
                `目标公司：${args.targetCompany}`,
                args.jobDescription?.trim()
                  ? `目标 JD：${args.jobDescription.trim()}`
                  : "未提供目标 JD，请按通用求职简历标准评估版式。",
                "请只输出一个 JSON 对象，不要输出 Markdown，不要补充解释。",
              ].join("\n\n"),
            },
            {
              type: "input_file",
              file_url: args.resumeFileUrl,
              filename: args.resumeName,
            },
          ],
        },
      ],
    });

    const outputText = response.output_text?.trim();
    if (!outputText) {
      throw new Error("版式点评未返回文本结果");
    }

    return resumeLayoutReviewSchema.parse(
      JSON.parse(extractJsonPayload(outputText)),
    );
  } catch (error) {
    console.warn("[resume-review-worker] layout review skipped", {
      resumeName: args.resumeName,
      message: error instanceof Error ? error.message : "版式点评失败",
    });
    return null;
  }
}

async function generateResumeReview(args: {
  resumeName: string;
  resumeText: string;
  snapshot: Record<string, unknown>;
  qualityReport: ResumeTextQualityReport;
  targetRole: string;
  targetCompany: string;
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
        targetRole: args.targetRole,
        targetCompany: args.targetCompany,
        hasJobDescription: !!args.jobDescription?.trim(),
        extractionLowConfidence: args.qualityReport.isLowConfidence,
        extractionQualityReasons: args.qualityReport.reasons,
      },
    },
    args.tracing,
  );
  const explicitModel = process.env.RESUME_REVIEW_MODEL?.trim();
  const model = (
    explicitModel
      ? createLangChainChatModel({
          model: explicitModel,
          temperature: 0.1,
          maxTokens: 5000,
          tracing,
        })
      : createLangChainChatModelForUseCase({
          useCase: "report-generate",
          temperature: 0.1,
          maxTokens: 5000,
          tracing,
        })
  ).withStructuredOutput(resumeReviewSchema, {
    method: "jsonSchema",
    strict: true,
  });

  return model.invoke([
    {
      role: "system",
      content: [
        "你是一位资深简历顾问。请用中文输出严格结构化的点评结果，评分要克制，建议要可执行，不要空话。",
        "你收到的是从 PDF/文本抽取得到的内容，不是原始版式文件，抽取过程可能引入 OCR/编码噪声。",
        "必须严格区分“候选人简历本身的问题”和“本次文本抽取造成的噪声”。",
        "不要仅凭抽取文本就推断原 PDF 存在字体嵌入、图标字体、分栏、表格、版式错乱等问题；除非输入里有直接证据，否则不能把这些当成ATS问题输出。",
        "如果发现文本提取质量较差，可以在 overallAssessment 中用一句短提示说明“本次点评受文本提取质量影响，部分细节仅供参考”，但不要把提取噪声当成候选人的能力短板。",
        "当原文存在乱码、损坏时间、异常技术关键词时，优先基于结构化快照和稳定语义做判断；不确定时少说，不要编造原因。",
        "ATSCompatibility 只输出用户真正可操作、且高度可信的建议。若问题主要来自文本抽取噪声，最多用 1 条简短 issue 提醒，不要展开成多条无效建议。",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `简历文件名：${args.resumeName}`,
        `目标岗位：${args.targetRole}`,
        `目标公司：${args.targetCompany}`,
        args.qualityReport.isLowConfidence
          ? `文本提取质量：低置信度。原因：${args.qualityReport.reasons.join("；")}`
          : "文本提取质量：正常。",
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
    const { record, snapshot, qualityReport } = await ensureResumeSnapshot(
      job.userId,
      job.payload.resumeStoragePath,
      tracing,
    );
    console.info("[resume-review-worker] resume snapshot ready", {
      jobId: job.id,
      durationMs: Date.now() - snapshotStartedAt,
      hasParsedText: !!record.parsedText,
      resumeName: record.fileName,
      extractionLowConfidence: qualityReport.isLowConfidence,
    });
    const generationStartedAt = Date.now();
    const generated = await generateResumeReview({
      resumeName: record.fileName,
      resumeText: record.parsedText ?? "",
      snapshot,
      qualityReport,
      targetRole: job.payload.targetRole,
      targetCompany: job.payload.targetCompany,
      jobDescription: job.payload.jobDescription,
      tracing,
    });
    const layoutReview = await generateResumeLayoutReview({
      resumeName: record.fileName,
      resumeFileUrl: record.fileUrl,
      targetRole: job.payload.targetRole,
      targetCompany: job.payload.targetCompany,
      jobDescription: job.payload.jobDescription,
    });
    console.info("[resume-review-worker] llm generation completed", {
      jobId: job.id,
      durationMs: Date.now() - generationStartedAt,
      sectionCount: generated.sections.length,
      hasLayoutReview: !!layoutReview,
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
      ...(layoutReview ? { layoutReview } : {}),
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

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
import {
  QUESTIONING_CONFIG,
  type QuestioningReport,
} from "@interviewclaw/domain";
import {
  buildJobTracingContext,
  ensureResumeSnapshot,
  getCapabilityModelInfo,
  type ResumeSnapshot,
} from "./shared";

const questioningSchema = z.object({
  summary: z.string(),
  highlights: z.array(z.string()).min(3).max(8),
  questions: z.array(
    z.object({
      question: z.string().describe("面试官会问的具体问题，结合简历内容自然措辞"),
      category: z
        .string()
        .describe("考察类别，如：项目经历真实性验证、技术深度、系统设计、行为面试"),
      answerGuide: z
        .string()
        .describe("回答思路，用 STAR 或其他框架拆解，标注背景/职责/挑战/成果"),
      referenceAnswer: z
        .string()
        .describe("参考答案，必须结合简历中的具体项目、技术栈和业务场景"),
      followUps: z
        .array(z.string())
        .min(1)
        .max(3)
        .describe("面试官可能追问的 1-3 个方向"),
    }),
  ),
});

function formatResumeForPrompt(snapshot: ResumeSnapshot): string {
  const sections: string[] = [];

  if (snapshot.personalInfo?.name) {
    sections.push(`姓名：${snapshot.personalInfo.name}`);
  }

  if (snapshot.education) {
    const edu = snapshot.education;
    const parts = [edu.school, edu.major, edu.degree].filter(Boolean);
    if (parts.length > 0) {
      sections.push(`教育背景：${parts.join(" · ")}`);
    }
  }

  if (snapshot.skills && snapshot.skills.length > 0) {
    sections.push(`技能清单：${snapshot.skills.join("、")}`);
  }

  if (snapshot.workExperiences && snapshot.workExperiences.length > 0) {
    const workLines = snapshot.workExperiences.map((w, i) => {
      const period =
        w.startDate || w.endDate
          ? ` (${w.startDate ?? "?"} ~ ${w.endDate ?? "至今"})`
          : "";
      return `  ${i + 1}. ${w.company} - ${w.position}${period}\n     ${w.description}`;
    });
    sections.push(`工作经历：\n${workLines.join("\n")}`);
  }

  if (snapshot.projectExperiences && snapshot.projectExperiences.length > 0) {
    const projLines = snapshot.projectExperiences.map((p, i) => {
      const role = p.role ? `（${p.role}）` : "";
      const stack =
        p.techStack && p.techStack.length > 0
          ? `\n     技术栈：${p.techStack.join("、")}`
          : "";
      return `  ${i + 1}. ${p.projectName}${role}${stack}\n     ${p.description}`;
    });
    sections.push(`项目经历：\n${projLines.join("\n")}`);
  }

  return sections.join("\n\n");
}

const QUESTIONING_SYSTEM_PROMPT = `你是一位资深技术面试官和面试教练，擅长针对候选人简历进行深度押题。

## 核心要求
1. **必须深度分析候选人简历**：针对每段项目经历、工作经历生成面试官真正会问的问题
2. **问题要自然具体**：用面试官的口吻提问，如"我看你简历上提到了在XX公司负责YY项目，能先跟我简单介绍一下这个项目的背景和你主要负责的部分吗？"
3. **参考答案必须结合简历**：基于候选人简历中的具体技术栈、项目背景、业务场景撰写参考答案，不要写泛泛的模板答案
4. **追问要有深度**：追问方向应考察候选人是否真正做过，涉及实现细节、技术选型理由、遇到的困难和解决方案
5. **覆盖多维度**：项目经历验证、技术深度、系统设计、行为面试、基础知识等

## 出题策略
- 优先从候选人简历中的项目和工作经历出发，生成个性化问题
- 结合目标岗位 JD 要求，补充技术深度和基础知识题
- 参考题库中的高频题目模板，但问题措辞必须贴合候选人的实际经历
- 每道题的回答思路用 STAR（背景-职责-挑战-成果）或类似框架拆解

## 输出规范
- summary：整体押题策略总结，说明为什么这样出题
- highlights：3-8 条高优先级备面提醒，具体到候选人应准备的知识点
- questions：8-12 道具体面试题，每道题包含问题、考察类别、回答思路、参考答案、追问方向`;

function isRetryableQuestioningError(error: unknown) {
  if (!(error instanceof Error)) {
    return true;
  }

  const message = error.message.toLowerCase();
  return ![
    "tool_choice",
    "no endpoints found",
    "model_not_found",
    "provider routing",
  ].some((pattern) => message.includes(pattern));
}

async function generateQuestioningReport(args: {
  targetRole: string;
  track: "social" | "campus";
  targetCompany?: string;
  jobDescription?: string;
  resumeSnapshot: ResumeSnapshot;
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
        hasResumeSnapshot: true,
      },
    },
    args.tracing,
  );
  const explicitModel = process.env.QUESTIONING_MODEL?.trim();
  const model = (
    explicitModel
      ? createLangChainChatModel({
          model: explicitModel,
          temperature: 0.4,
          maxTokens: 8000,
          tracing,
        })
      : createLangChainChatModelForUseCase({
          useCase: "question-predict",
          temperature: 0.4,
          maxTokens: 8000,
          tracing,
        })
  ).withStructuredOutput(questioningSchema, {
    method: "functionCalling",
  });

  const resumeText = formatResumeForPrompt(args.resumeSnapshot);
  const questionTemplates = args.plan.questions
    .map(
      (q) =>
        `- [${q.questionType}] ${q.questionText}（考点：${q.topics.join("、")}）`,
    )
    .join("\n");

  console.info("[questioning-worker] llm invoke start", {
    resumeTextLength: resumeText.length,
    questionTemplateCount: args.plan.questions.length,
    model: explicitModel || "use-case-route",
    timeoutMs: QUESTIONING_CONFIG.generationTimeoutMs,
  });

  const abort = new AbortController();
  const timer = setTimeout(
    () => abort.abort(),
    QUESTIONING_CONFIG.generationTimeoutMs,
  );

  try {
    return await model.invoke(
      [
        {
          role: "system",
          content: QUESTIONING_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            `## 候选人简历`,
            resumeText,
            "",
            `## 目标信息`,
            `目标岗位：${args.targetRole}`,
            `求职赛道：${args.track === "social" ? "社招" : "校招"}`,
            args.targetCompany ? `目标公司：${args.targetCompany}` : "",
            args.jobDescription?.trim()
              ? `目标 JD：${args.jobDescription.trim()}`
              : "",
            "",
            `## 参考题库（作为出题方向参考，不必拘泥于原题）`,
            questionTemplates || "（题库为空，请完全基于简历和岗位要求出题）",
            "",
            "请基于以上信息，生成 8-12 道针对该候选人的个性化面试押题。",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
      { signal: abort.signal },
    );
  } finally {
    clearTimeout(timer);
  }
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
      limit: 12,
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
      resumeSnapshot: snapshot,
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

    const questions = generated.questions.map((gq, idx) => ({
      questionId: `q-${job.id}-${idx}`,
      questionText: gq.question,
      questionType: "project" as const,
      topics: [] as string[],
      expectedSignals: [] as string[],
      reason: gq.category,
      preparationAdvice: gq.answerGuide,
      category: gq.category,
      answerGuide: gq.answerGuide,
      referenceAnswer: gq.referenceAnswer,
      followUps: gq.followUps,
    }));

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
      terminal: !isRetryableQuestioningError(error),
    });
    return job.id;
  }
}

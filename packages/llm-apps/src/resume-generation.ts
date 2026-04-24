import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  createLangChainChatModelForUseCase,
  mergeLangfuseTracingContext,
  type LangfuseTracingContext,
} from "@interviewclaw/ai-runtime";
import {
  claimNextResumeGenerationJob,
  completeResumeGenerationJob,
  createResumeVersion,
  failResumeGenerationJob,
  getSupabaseAdminClient,
} from "@interviewclaw/data-access";
import type {
  ResumeGenerationDirectionPreset,
  ResumeGenerationJobPayload,
  ResumeGenerationLanguage,
  ResumeGenerationMessage,
  ResumeGenerationMissingField,
  ResumeGenerationSession,
  ResumeGenerationSessionStatus,
  ResumePortraitDraft,
  ResumePortraitEducation,
  ResumePortraitExperience,
  ResumePortraitPersonalInfo,
  ResumePortraitProject,
} from "@interviewclaw/domain";
import {
  buildJobTracingContext,
  ensureResumeSnapshot,
  getCapabilityModelInfo,
} from "./shared";

const resumeDirectionLabels: Record<ResumeGenerationDirectionPreset, string> = {
  general: "通用中文",
  english: "英文简历",
  "state-owned": "央国企/国企",
  "hardcore-tech": "硬核技术",
  marketing: "市场营销",
  postgraduate: "考研/学术申请",
  "civil-service": "公务员/事业单位",
  custom: "自定义方向",
};

const resumeGenerationIntakeTurnSchema = z.object({
  assistantQuestion: z.string(),
  suggestedAnswerHints: z.array(z.string()).max(4),
});

const resumePortraitSchema = z.object({
  sourceResumeName: z.string().optional(),
  directionPreset: z.enum([
    "general",
    "english",
    "state-owned",
    "hardcore-tech",
    "marketing",
    "postgraduate",
    "civil-service",
    "custom",
  ]),
  language: z.enum(["zh-CN", "en-US"]),
  customStylePrompt: z.string().optional(),
  targetRole: z.string().optional(),
  summary: z.string().optional(),
  personalInfo: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      github: z.string().optional(),
      linkedin: z.string().optional(),
    })
    .optional(),
  education: z
    .object({
      school: z.string().optional(),
      major: z.string().optional(),
      degree: z.string().optional(),
      graduationDate: z.string().optional(),
      extraNotes: z.array(z.string()).optional(),
    })
    .optional(),
  skills: z.array(z.string()),
  workExperiences: z.array(
    z.object({
      company: z.string().optional(),
      position: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      summary: z.string().optional(),
      highlights: z.array(z.string()).optional(),
    }),
  ),
  projectExperiences: z.array(
    z.object({
      projectName: z.string().optional(),
      role: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      techStack: z.array(z.string()).optional(),
      summary: z.string().optional(),
      highlights: z.array(z.string()).optional(),
    }),
  ),
  rawUserNotes: z.array(z.string()),
});

const resumeRenderSchema = z.object({
  title: z.string(),
  summary: z.string(),
  markdown: z.string(),
});

const assetCache = new Map<string, string>();

function normalizeString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function toSentenceList(text: string) {
  return text
    .split(/\n|[；;。]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeSkills(input: string[] | undefined) {
  return (input ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function mapPersonalInfo(
  snapshot: Record<string, any>,
): ResumePortraitPersonalInfo {
  const personal = snapshot.personalInfo ?? {};
  return {
    name: normalizeString(personal.name),
    email: normalizeString(personal.email),
    phone: normalizeString(personal.phone),
  };
}

function mapEducation(
  snapshot: Record<string, any>,
): ResumePortraitEducation | undefined {
  const education = snapshot.education;
  if (!education) {
    return undefined;
  }

  return {
    school: normalizeString(education.school),
    major: normalizeString(education.major),
    degree: normalizeString(education.degree),
    graduationDate: normalizeString(education.graduationDate),
  };
}

function mapWorkExperiences(
  snapshot: Record<string, any>,
): ResumePortraitExperience[] {
  return Array.isArray(snapshot.workExperiences)
    ? snapshot.workExperiences.map((item: any) => ({
        company: normalizeString(item.company),
        position: normalizeString(item.position),
        startDate: normalizeString(item.startDate),
        endDate: normalizeString(item.endDate),
        summary: normalizeString(item.description),
        highlights: normalizeString(item.description)
          ? toSentenceList(item.description)
          : [],
      }))
    : [];
}

function mapProjectExperiences(
  snapshot: Record<string, any>,
): ResumePortraitProject[] {
  return Array.isArray(snapshot.projectExperiences)
    ? snapshot.projectExperiences.map((item: any) => ({
        projectName: normalizeString(item.projectName),
        role: normalizeString(item.role),
        startDate: normalizeString(item.startDate),
        endDate: normalizeString(item.endDate),
        techStack: normalizeSkills(item.techStack),
        summary: normalizeString(item.description),
        highlights: normalizeString(item.description)
          ? toSentenceList(item.description)
          : [],
      }))
    : [];
}

function createInitialPortraitDraft(input: {
  snapshot: Record<string, any>;
  sourceResumeName?: string;
  directionPreset: ResumeGenerationDirectionPreset;
  customStylePrompt?: string;
  language: ResumeGenerationLanguage;
}): ResumePortraitDraft {
  return {
    sourceResumeName: input.sourceResumeName,
    directionPreset: input.directionPreset,
    language: input.language,
    customStylePrompt: normalizeString(input.customStylePrompt),
    targetRole: normalizeString(input.snapshot.jobIntention),
    summary: undefined,
    personalInfo: mapPersonalInfo(input.snapshot),
    education: mapEducation(input.snapshot),
    skills: normalizeSkills(input.snapshot.skills),
    workExperiences: mapWorkExperiences(input.snapshot),
    projectExperiences: mapProjectExperiences(input.snapshot),
    rawUserNotes: [],
  };
}

function hasEducationInfo(education?: ResumePortraitEducation) {
  return Boolean(
    education &&
      [
        education.school,
        education.major,
        education.degree,
        ...(education.extraNotes ?? []),
      ].some((item) => Boolean(normalizeString(item))),
  );
}

function hasExperienceInfo(portrait: ResumePortraitDraft) {
  if (
    portrait.workExperiences.some(
      (item) =>
        normalizeString(item.company) ||
        normalizeString(item.position) ||
        normalizeString(item.summary),
    )
  ) {
    return true;
  }

  if (
    portrait.projectExperiences.some(
      (item) =>
        normalizeString(item.projectName) ||
        normalizeString(item.summary) ||
        (item.techStack?.length ?? 0) > 0,
    )
  ) {
    return true;
  }

  return portrait.rawUserNotes.some((item) => item.startsWith("经历补充："));
}

export function collectResumeGenerationMissingFields(
  portrait: ResumePortraitDraft,
) {
  const missingFields: ResumeGenerationMissingField[] = [];

  if (!normalizeString(portrait.targetRole)) {
    missingFields.push("targetRole");
  }
  if (!normalizeString(portrait.summary)) {
    missingFields.push("summary");
  }
  if (!hasExperienceInfo(portrait)) {
    missingFields.push("experience");
  }
  if (portrait.skills.length === 0) {
    missingFields.push("skills");
  }
  if (!hasEducationInfo(portrait.education)) {
    missingFields.push("education");
  }

  const personal = portrait.personalInfo;
  const hasContact =
    Boolean(normalizeString(personal?.name)) &&
    Boolean(
      normalizeString(personal?.phone) ||
        normalizeString(personal?.email) ||
        normalizeString(personal?.location) ||
        normalizeString(personal?.github) ||
        normalizeString(personal?.linkedin),
    );

  if (!hasContact) {
    missingFields.push("contact");
  }

  return missingFields;
}

function fallbackIntakeTurn(
  field: ResumeGenerationMissingField | undefined,
): z.infer<typeof resumeGenerationIntakeTurnSchema> {
  const mapping: Record<
    ResumeGenerationMissingField,
    z.infer<typeof resumeGenerationIntakeTurnSchema>
  > = {
    targetRole: {
      assistantQuestion:
        "这份简历你准备主要投什么岗位或方向？如果有特定风格诉求，也可以一起说清楚。",
      suggestedAnswerHints: [
        "目标岗位名称",
        "投递方向，比如英文/央国企/技术向",
        "你最想强调的优势",
      ],
    },
    summary: {
      assistantQuestion:
        "请用 2-3 句话概括你的核心优势，尽量带上年限、方向和最能证明你的成果。",
      suggestedAnswerHints: [
        "你的年限/阶段",
        "最擅长的方向",
        "1 个最有说服力的结果",
      ],
    },
    experience: {
      assistantQuestion:
        "请补充 1-2 段最值得写进简历的经历，按 背景-职责-动作-结果 说清楚，最好带数据。",
      suggestedAnswerHints: [
        "项目背景或业务场景",
        "你具体负责什么",
        "最终结果或指标提升",
      ],
    },
    skills: {
      assistantQuestion:
        "请补充与你目标岗位最相关的技能、工具、证书或方法论，按重要程度列出来。",
      suggestedAnswerHints: ["技术栈/工具", "证书", "专项能力"],
    },
    education: {
      assistantQuestion:
        "请补充教育背景，至少包含学校、专业、学历和毕业时间；有荣誉也可以一起写。",
      suggestedAnswerHints: ["学校", "专业/学历", "毕业时间"],
    },
    contact: {
      assistantQuestion:
        "请补充姓名和联系方式，至少给出手机号、邮箱或所在城市中的一项。",
      suggestedAnswerHints: ["姓名", "手机号/邮箱", "城市/GitHub/LinkedIn"],
    },
  };

  return (
    (field ? mapping[field] : undefined) ?? {
      assistantQuestion: "信息已经够了，可以开始生成简历了。",
      suggestedAnswerHints: [],
    }
  );
}

function appendRawUserNote(portrait: ResumePortraitDraft, note: string) {
  return {
    ...portrait,
    rawUserNotes: [...portrait.rawUserNotes, note],
  };
}

function applyAnswerToDraft(
  portrait: ResumePortraitDraft,
  field: ResumeGenerationMissingField | undefined,
  answer: string,
) {
  const cleanAnswer = answer.trim();
  if (!cleanAnswer) {
    return portrait;
  }

  if (field === "targetRole") {
    return appendRawUserNote(
      {
        ...portrait,
        targetRole: cleanAnswer,
      },
      `目标方向补充：${cleanAnswer}`,
    );
  }

  if (field === "summary") {
    return appendRawUserNote(
      {
        ...portrait,
        summary: cleanAnswer,
      },
      `优势总结：${cleanAnswer}`,
    );
  }

  if (field === "skills") {
    const nextSkills = Array.from(
      new Set(
        cleanAnswer
          .split(/[、,，/\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
          .concat(portrait.skills),
      ),
    ).slice(0, 16);

    return appendRawUserNote(
      {
        ...portrait,
        skills: nextSkills,
      },
      `技能补充：${cleanAnswer}`,
    );
  }

  if (field === "education") {
    return appendRawUserNote(
      {
        ...portrait,
        education: {
          ...portrait.education,
          extraNotes: [...(portrait.education?.extraNotes ?? []), cleanAnswer],
        },
      },
      `教育补充：${cleanAnswer}`,
    );
  }

  if (field === "experience") {
    return appendRawUserNote(
      {
        ...portrait,
        workExperiences: [
          ...portrait.workExperiences,
          {
            summary: cleanAnswer,
            highlights: toSentenceList(cleanAnswer),
          },
        ],
      },
      `经历补充：${cleanAnswer}`,
    );
  }

  if (field === "contact") {
    const email = cleanAnswer.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    )?.[0];
    const phone = cleanAnswer.match(
      /(?:\+?86[- ]?)?1[3-9]\d{9}|(?:\d{3,4}[- ]?)?\d{7,8}/,
    )?.[0];
    const github = cleanAnswer.match(/github\.com\/[^\s]+/i)?.[0];
    const linkedin = cleanAnswer.match(/linkedin\.com\/[^\s]+/i)?.[0];
    const possibleName =
      cleanAnswer
        .split(/[，,|｜/ ]/)
        .map((item) => item.trim())
        .find((item) =>
          /^[A-Za-z]{2,30}$|^[\u4E00-\u9FA5]{2,8}$/u.test(item),
        ) ?? portrait.personalInfo?.name;

    return appendRawUserNote(
      {
        ...portrait,
        personalInfo: {
          ...portrait.personalInfo,
          name: normalizeString(portrait.personalInfo?.name) ?? possibleName,
          email: normalizeString(portrait.personalInfo?.email) ?? email,
          phone: normalizeString(portrait.personalInfo?.phone) ?? phone,
          github: normalizeString(portrait.personalInfo?.github) ?? github,
          linkedin:
            normalizeString(portrait.personalInfo?.linkedin) ?? linkedin,
          location: portrait.personalInfo?.location ?? cleanAnswer,
        },
      },
      `联系方式补充：${cleanAnswer}`,
    );
  }

  return appendRawUserNote(portrait, `补充信息：${cleanAnswer}`);
}

async function loadResumeGenerationAsset(name: string) {
  const cached = assetCache.get(name);
  if (cached) {
    return cached;
  }

  const filePath = path.resolve(
    process.cwd(),
    `skills/resume-generation/${name}.md`,
  );
  const content = await readFile(filePath, "utf-8");
  assetCache.set(name, content);
  return content;
}

async function buildIntakeTurn(input: {
  portraitDraft: ResumePortraitDraft;
  missingFields: ResumeGenerationMissingField[];
  tracing?: LangfuseTracingContext;
}) {
  const firstMissing = input.missingFields[0];
  if (!firstMissing) {
    return fallbackIntakeTurn(undefined);
  }

  try {
    const intakePrompt = await loadResumeGenerationAsset("intake");
    const model = createLangChainChatModelForUseCase({
      useCase: "report-generate",
      temperature: 0.2,
      maxTokens: 800,
      tracing: mergeLangfuseTracingContext(
        {
          traceName: "resume-generation-intake",
          generationName: "resume-generation-intake-turn",
          tags: ["resume-generation", "intake"],
          metadata: {
            missingFields: input.missingFields,
          },
        },
        input.tracing,
      ),
    }).withStructuredOutput(resumeGenerationIntakeTurnSchema, {
      method: "functionCalling",
    });

    return await model.invoke([
      {
        role: "system",
        content: intakePrompt,
      },
      {
        role: "user",
        content: [
          `当前缺失字段：${input.missingFields.join("、")}`,
          `优先追问字段：${firstMissing}`,
          `当前画像草稿：${JSON.stringify(input.portraitDraft)}`,
          "请只生成下一轮提问和 2-4 个回答提示。",
        ].join("\n\n"),
      },
    ]);
  } catch (error) {
    console.warn("[resume-generation] intake turn fallback", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return fallbackIntakeTurn(firstMissing);
  }
}

export async function createResumeGenerationSessionDraft(input: {
  userId: string;
  sourceResumeStoragePath: string;
  directionPreset: ResumeGenerationDirectionPreset;
  customStylePrompt?: string;
  language: ResumeGenerationLanguage;
}) {
  const snapshotResult = await ensureResumeSnapshot(
    input.userId,
    input.sourceResumeStoragePath,
  );
  const portraitDraft = createInitialPortraitDraft({
    snapshot: snapshotResult.snapshot as Record<string, any>,
    sourceResumeName: snapshotResult.record.fileName,
    directionPreset: input.directionPreset,
    customStylePrompt: input.customStylePrompt,
    language: input.language,
  });
  const missingFields = collectResumeGenerationMissingFields(portraitDraft);
  const sessionStatus: ResumeGenerationSessionStatus =
    missingFields.length > 0 ? "collecting" : "ready";
  const intakeTurn = await buildIntakeTurn({
    portraitDraft,
    missingFields,
  });
  const now = new Date().toISOString();
  const messages: ResumeGenerationMessage[] =
    sessionStatus === "collecting"
      ? [
          {
            role: "assistant",
            content: intakeTurn.assistantQuestion,
            createdAt: now,
          },
        ]
      : [];

  return {
    sessionStatus,
    portraitDraft,
    missingFields,
    assistantQuestion:
      sessionStatus === "collecting" ? intakeTurn.assistantQuestion : undefined,
    suggestedAnswerHints:
      sessionStatus === "collecting" ? intakeTurn.suggestedAnswerHints : [],
    messages,
  };
}

export async function continueResumeGenerationSession(
  session: ResumeGenerationSession,
  answer: string,
) {
  const updatedPortrait = applyAnswerToDraft(
    session.portraitDraft,
    session.missingFields[0],
    answer,
  );
  const missingFields = collectResumeGenerationMissingFields(updatedPortrait);
  const sessionStatus: ResumeGenerationSessionStatus =
    missingFields.length > 0 ? "collecting" : "ready";
  const userMessage: ResumeGenerationMessage = {
    role: "user",
    content: answer.trim(),
    createdAt: new Date().toISOString(),
  };

  if (sessionStatus === "ready") {
    return {
      sessionStatus,
      portraitDraft: updatedPortrait,
      missingFields,
      assistantQuestion: undefined,
      suggestedAnswerHints: [],
      messages: [...session.messages, userMessage],
    };
  }

  const nextTurn = await buildIntakeTurn({
    portraitDraft: updatedPortrait,
    missingFields,
  });
  const assistantMessage: ResumeGenerationMessage = {
    role: "assistant",
    content: nextTurn.assistantQuestion,
    createdAt: new Date().toISOString(),
  };

  return {
    sessionStatus,
    portraitDraft: updatedPortrait,
    missingFields,
    assistantQuestion: nextTurn.assistantQuestion,
    suggestedAnswerHints: nextTurn.suggestedAnswerHints,
    messages: [...session.messages, userMessage, assistantMessage],
  };
}

async function normalizePortraitForRender(input: {
  payload: ResumeGenerationJobPayload;
  sourceSnapshot: Record<string, unknown>;
  tracing?: LangfuseTracingContext;
}) {
  const normalizePrompt = await loadResumeGenerationAsset("portrait-normalize");
  const model = createLangChainChatModelForUseCase({
    useCase: "report-generate",
    temperature: 0.1,
    maxTokens: 2500,
    tracing: mergeLangfuseTracingContext(
      {
        traceName: "resume-generation-job",
        generationName: "resume-generation-normalize",
        tags: ["resume-generation", "normalize"],
        metadata: {
          directionPreset: input.payload.directionPreset,
          language: input.payload.language,
        },
      },
      input.tracing,
    ),
  }).withStructuredOutput(resumePortraitSchema, {
    method: "functionCalling",
  });

  return resumePortraitSchema.parse(
    await model.invoke([
      {
        role: "system",
        content: normalizePrompt,
      },
      {
        role: "user",
        content: [
          `投递方向：${resumeDirectionLabels[input.payload.directionPreset]}`,
          `语言：${input.payload.language}`,
          input.payload.customStylePrompt
            ? `自定义要求：${input.payload.customStylePrompt}`
            : "",
          `来源简历快照：${JSON.stringify(input.sourceSnapshot)}`,
          `当前画像草稿：${JSON.stringify(input.payload.portraitSnapshot)}`,
          "请输出规范化后的最终画像。",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ]),
  );
}

async function renderResumeMarkdown(input: {
  portrait: ResumePortraitDraft;
  tracing?: LangfuseTracingContext;
}) {
  const renderPrompt = await loadResumeGenerationAsset("resume-render");
  const model = createLangChainChatModelForUseCase({
    useCase: "report-generate",
    temperature: 0.2,
    maxTokens: 5000,
    tracing: mergeLangfuseTracingContext(
      {
        traceName: "resume-generation-job",
        generationName: "resume-generation-render",
        tags: ["resume-generation", "render"],
        metadata: {
          directionPreset: input.portrait.directionPreset,
          language: input.portrait.language,
        },
      },
      input.tracing,
    ),
  }).withStructuredOutput(resumeRenderSchema, {
    method: "functionCalling",
  });

  return resumeRenderSchema.parse(
    await model.invoke([
      {
        role: "system",
        content: renderPrompt,
      },
      {
        role: "user",
        content: [
          `投递方向：${resumeDirectionLabels[input.portrait.directionPreset]}`,
          `语言：${input.portrait.language}`,
          input.portrait.customStylePrompt
            ? `自定义要求：${input.portrait.customStylePrompt}`
            : "",
          `最终画像：${JSON.stringify(input.portrait)}`,
          "请输出 title、summary、markdown。markdown 只包含简历内容，不要额外解释。",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ]),
  );
}

async function uploadMarkdownArtifact(input: {
  userId: string;
  markdown: string;
  versionId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const storagePath = `generated/${input.userId}/${input.versionId}.md`;
  const { error } = await supabase.storage
    .from("resumes")
    .upload(storagePath, Buffer.from(input.markdown, "utf-8"), {
      contentType: "text/markdown; charset=utf-8",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload markdown artifact: ${error.message}`);
  }

  return storagePath;
}

export async function runOneResumeGenerationJob() {
  const job = await claimNextResumeGenerationJob();
  if (!job) {
    return null;
  }

  const tracing = buildJobTracingContext({
    userId: job.userId,
    jobId: job.id,
    jobType: "resume-generation",
    resumeStoragePath: job.payload.sourceResumeStoragePath,
    metadata: {
      capability: "resume-generation",
      sessionId: job.payload.sessionId,
      directionPreset: job.payload.directionPreset,
    },
  });

  const { providerId, model } = getCapabilityModelInfo({
    useCase: "report-generate",
  });

  try {
    const resumeSnapshot = await ensureResumeSnapshot(
      job.userId,
      job.payload.sourceResumeStoragePath,
      tracing,
    );
    const normalizedPortrait = await normalizePortraitForRender({
      payload: job.payload,
      sourceSnapshot: resumeSnapshot.snapshot as Record<string, unknown>,
      tracing,
    });
    const rendered = await renderResumeMarkdown({
      portrait: normalizedPortrait,
      tracing,
    });
    const versionSlug = job.id;
    const markdownStoragePath = await uploadMarkdownArtifact({
      userId: job.userId,
      markdown: rendered.markdown,
      versionId: versionSlug,
    });
    const version = await createResumeVersion({
      userId: job.userId,
      sessionId: job.payload.sessionId,
      sourceResumeStoragePath: job.payload.sourceResumeStoragePath,
      directionPreset: job.payload.directionPreset,
      customStylePrompt: job.payload.customStylePrompt,
      language: job.payload.language,
      title: rendered.title,
      summary: rendered.summary,
      previewSlug: versionSlug,
      markdownStoragePath,
      markdownContent: rendered.markdown,
    });

    await completeResumeGenerationJob({
      jobId: job.id,
      providerId,
      model,
      result: {
        versionId: version.id,
        title: rendered.title,
        markdownStoragePath,
        previewUrl: `/resume-generation/versions/${version.id}`,
        summary: rendered.summary,
      },
    });

    return version;
  } catch (error) {
    await failResumeGenerationJob({
      jobId: job.id,
      providerId,
      model,
      errorMessage:
        error instanceof Error ? error.message : "简历生成任务执行失败",
      terminal:
        error instanceof Error && error.message.includes("简历解析结果为空"),
    });
    throw error;
  }
}

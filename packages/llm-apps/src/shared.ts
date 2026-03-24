import { extractText } from "unpdf";
import { z } from "zod";
import {
  resolveAiModelRoute,
  createLangChainChatModel,
  mergeLangfuseTracingContext,
  resolveOpenAICompatibleConfig,
  type AiUseCase,
  type AiUserTier,
  type LangfuseTracingContext,
} from "@interviewclaw/ai-runtime";
import {
  getResumeRecordByStoragePath,
  getSupabaseAdminClient,
  upsertResumeRecord,
} from "@interviewclaw/data-access";

function logLlmStep(
  scope: string,
  message: string,
  data?: Record<string, unknown>,
) {
  console.info(`[llm-apps:${scope}] ${message}`, data ?? {});
}

export const resumeSnapshotSchema = z.object({
  personalInfo: z
    .object({
      name: z.string().nullish(),
      email: z.string().nullish(),
      phone: z.string().nullish(),
    })
    .nullish(),
  jobIntention: z.string().nullish(),
  experienceYears: z.number().nullish(),
  skills: z.array(z.string()).nullish(),
  education: z
    .object({
      school: z.string().nullish(),
      major: z.string().nullish(),
      degree: z.string().nullish(),
      graduationDate: z.string().nullish(),
    })
    .nullish(),
  workExperiences: z
    .array(
      z.object({
        company: z.string(),
        position: z.string(),
        startDate: z.string().nullish(),
        endDate: z.string().nullish(),
        description: z.string(),
      }),
    )
    .nullish(),
  projectExperiences: z
    .array(
      z.object({
        projectName: z.string(),
        role: z.string().nullish(),
        startDate: z.string().nullish(),
        endDate: z.string().nullish(),
        techStack: z.array(z.string()).nullish(),
        description: z.string(),
      }),
    )
    .nullish(),
}).strict();

export type ResumeSnapshot = z.infer<typeof resumeSnapshotSchema>;

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasMeaningfulEducation(snapshot: ResumeSnapshot) {
  return Boolean(
    snapshot.education &&
      [snapshot.education.school, snapshot.education.major, snapshot.education.degree].some(
        hasNonEmptyString,
      ),
  );
}

function hasMeaningfulWorkExperiences(snapshot: ResumeSnapshot) {
  return Boolean(
    snapshot.workExperiences?.some(
      (item) =>
        hasNonEmptyString(item.company) ||
        hasNonEmptyString(item.position) ||
        hasNonEmptyString(item.description),
    ),
  );
}

function hasMeaningfulProjectExperiences(snapshot: ResumeSnapshot) {
  return Boolean(
    snapshot.projectExperiences?.some(
      (item) =>
        hasNonEmptyString(item.projectName) ||
        hasNonEmptyString(item.role) ||
        hasNonEmptyString(item.description) ||
        Boolean(item.techStack?.length),
    ),
  );
}

export function hasUsableResumeSnapshot(snapshot: ResumeSnapshot) {
  return Boolean(
    hasMeaningfulEducation(snapshot) ||
      hasMeaningfulWorkExperiences(snapshot) ||
      hasMeaningfulProjectExperiences(snapshot) ||
      Boolean(snapshot.skills?.length) ||
      hasNonEmptyString(snapshot.jobIntention),
  );
}

function parseCachedResumeSnapshot(raw: unknown) {
  const parsed = resumeSnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  return parsed.data;
}

function getModelConfig(input?: {
  envModelKey?: string;
  useCase?: AiUseCase;
  userTier?: AiUserTier;
}) {
  const explicitModel = input?.envModelKey
    ? process.env[input.envModelKey]?.trim()
    : undefined;

  if (explicitModel) {
    const resolved = resolveOpenAICompatibleConfig({
      defaultModel: explicitModel,
    });
    return {
      providerId: resolved.providerId,
      model: explicitModel,
    };
  }

  if (input?.useCase) {
    const route = resolveAiModelRoute({
      useCase: input.useCase,
      userTier: input.userTier,
    });
    return {
      providerId: route.providerId,
      model: route.model,
    };
  }

  const resolved = resolveOpenAICompatibleConfig();
  return {
    providerId: resolved.providerId,
    model: resolved.model,
  };
}

async function extractResumeTextFromStorage(storagePath: string) {
  const startedAt = Date.now();
  const supabase = getSupabaseAdminClient();
  logLlmStep("resume-snapshot", "start download resume", { storagePath });
  const { data, error } = await supabase.storage
    .from("resumes")
    .download(storagePath);

  if (error || !data) {
    throw new Error(error?.message || "下载简历失败");
  }

  const buffer = await data.arrayBuffer();
  logLlmStep("resume-snapshot", "resume downloaded", {
    storagePath,
    durationMs: Date.now() - startedAt,
    fileSizeBytes: buffer.byteLength,
  });
  const extractStartedAt = Date.now();
  const { text } = await extractText(new Uint8Array(buffer), {
    mergePages: true,
  });
  logLlmStep("resume-snapshot", "resume text extracted", {
    storagePath,
    durationMs: Date.now() - extractStartedAt,
    textLength: text?.trim().length ?? 0,
  });

  if (!text?.trim()) {
    throw new Error("简历 PDF 无法提取文本");
  }

  return {
    text: text.trim(),
    fileName: storagePath.split("/").pop() ?? "resume.pdf",
  };
}

export async function analyzeResumeSnapshot(
  text: string,
  tracing?: LangfuseTracingContext,
) {
  const startedAt = Date.now();
  const model = createLangChainChatModel({
    temperature: 0,
    maxTokens: 4000,
    tracing: mergeLangfuseTracingContext(
      {
        traceName: "resume-snapshot-job",
        generationName: "resume-snapshot-analysis",
        tags: ["llm-apps", "resume-snapshot"],
        metadata: {
          textLength: text.length,
        },
      },
      tracing,
    ),
  }).withStructuredOutput(resumeSnapshotSchema, {
    method: "functionCalling",
  });
  logLlmStep("resume-snapshot", "start structured snapshot analysis", {
    textLength: text.length,
  });
  const result = await model.invoke([
    {
      role: "system",
      content:
        "你是专业的中文简历结构化解析助手。请严格按 schema 提取信息，缺失字段返回 null 或空数组，不要虚构经历。",
    },
    {
      role: "user",
      content: `请解析这份简历：\n\n${text}`,
    },
  ]);
  logLlmStep("resume-snapshot", "structured snapshot analysis completed", {
    durationMs: Date.now() - startedAt,
  });
  return resumeSnapshotSchema.parse(result);
}

export function buildJobTracingContext(input: {
  userId: string;
  jobId: string;
  jobType: "questioning" | "resume-review";
  resumeStoragePath: string;
  metadata?: Record<string, unknown>;
}): LangfuseTracingContext {
  return {
    userId: input.userId,
    sessionId: input.jobId,
    tags: ["llm-apps", input.jobType],
    metadata: {
      jobId: input.jobId,
      jobType: input.jobType,
      resumeStoragePath: input.resumeStoragePath,
      ...(input.metadata ?? {}),
    },
  };
}

export async function ensureResumeSnapshot(
  userId: string,
  storagePath: string,
  tracing?: LangfuseTracingContext,
) {
  const startedAt = Date.now();
  const existing = await getResumeRecordByStoragePath(userId, storagePath);
  if (existing?.parsedText && existing.parsedJson) {
    const cachedSnapshot = parseCachedResumeSnapshot(existing.parsedJson);
    if (cachedSnapshot && hasUsableResumeSnapshot(cachedSnapshot)) {
      logLlmStep("resume-snapshot", "reuse cached snapshot", {
        userId,
        storagePath,
        durationMs: Date.now() - startedAt,
      });
      return {
        record: existing,
        snapshot: cachedSnapshot,
      };
    }

    logLlmStep("resume-snapshot", "cached snapshot invalid, rebuilding", {
      userId,
      storagePath,
      hasParsedText: true,
      parsedJsonKeys:
        existing.parsedJson && typeof existing.parsedJson === "object"
          ? Object.keys(existing.parsedJson)
          : [],
    });
  }

  let text = existing?.parsedText?.trim();
  let fileName = existing?.fileName ?? storagePath.split("/").pop() ?? "resume.pdf";

  if (!text) {
    logLlmStep("resume-snapshot", "cache miss, rebuilding snapshot", {
      userId,
      storagePath,
    });

    const extracted = await extractResumeTextFromStorage(storagePath);
    text = extracted.text;
    fileName = extracted.fileName;
  }

  const snapshot = await analyzeResumeSnapshot(
    text,
    mergeLangfuseTracingContext(
      {
        metadata: {
          storagePath,
        },
      },
      tracing,
    ),
  );

  if (!hasUsableResumeSnapshot(snapshot)) {
    throw new Error("简历解析结果为空，无法生成个性化押题");
  }

  const supabase = getSupabaseAdminClient();
  const {
    data: { publicUrl },
  } = supabase.storage.from("resumes").getPublicUrl(storagePath);

  const record = await upsertResumeRecord({
    userId,
    storagePath,
    fileUrl: publicUrl,
    fileName,
    parsedText: text,
    parsedJson: snapshot,
    processingStatus: "completed",
    lastProcessedAt: new Date().toISOString(),
  });

  logLlmStep("resume-snapshot", "snapshot persisted", {
    userId,
    storagePath,
    textLength: text.length,
    durationMs: Date.now() - startedAt,
  });

  return {
    record,
    snapshot,
  };
}

export function getCapabilityModelInfo(input?: {
  envModelKey?: string;
  useCase?: AiUseCase;
  userTier?: AiUserTier;
}) {
  return getModelConfig(input);
}

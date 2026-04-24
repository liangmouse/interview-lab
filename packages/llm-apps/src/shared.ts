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

export const resumeSnapshotSchema = z
  .object({
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
  })
  .strict();

export type ResumeSnapshot = z.infer<typeof resumeSnapshotSchema>;

export type ResumeTextQualityReport = {
  isLowConfidence: boolean;
  reasons: string[];
  privateUseGlyphCount: number;
  suspiciousTokenCount: number;
  malformedDateCount: number;
};

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

function normalizeWhitespace(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function isLikelyCorruptedToken(token: string) {
  const normalized = token.trim();
  if (!normalized) {
    return false;
  }

  if (/[\uE000-\uF8FF<>�]/u.test(normalized)) {
    return true;
  }

  if (/[A-Za-z][./\\_-]{2,}[A-Za-z0-9]/.test(normalized)) {
    return true;
  }

  if (/[A-Za-z][^A-Za-z0-9+#.\- ]/.test(normalized)) {
    return true;
  }

  if (/^[./\\-]*\d[./\\-]+\d/.test(normalized)) {
    return true;
  }

  return false;
}

function sanitizeDateValue(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  if (
    /^\d{4}([.-]\d{1,2}){1,2}$/.test(normalized) ||
    /^\d{4}$/.test(normalized) ||
    /^(至今|present)$/i.test(normalized)
  ) {
    return normalized;
  }

  if (/[\uE000-\uF8FF<>�]/u.test(normalized) || /[./\\]{2,}/.test(normalized)) {
    return null;
  }

  return normalized;
}

function sanitizeTokenList(tokens: string[] | null | undefined) {
  if (!tokens?.length) {
    return tokens;
  }

  const cleaned = tokens
    .map((token) => normalizeWhitespace(token))
    .filter((token): token is string => Boolean(token))
    .filter((token) => !isLikelyCorruptedToken(token));

  return cleaned.length > 0 ? cleaned : [];
}

function sanitizeResumeSnapshot(snapshot: ResumeSnapshot): ResumeSnapshot {
  return {
    ...snapshot,
    skills: sanitizeTokenList(snapshot.skills),
    education: snapshot.education
      ? {
          ...snapshot.education,
          graduationDate: sanitizeDateValue(snapshot.education.graduationDate),
        }
      : snapshot.education,
    workExperiences: snapshot.workExperiences?.map((item) => ({
      ...item,
      startDate: sanitizeDateValue(item.startDate),
      endDate: sanitizeDateValue(item.endDate),
    })),
    projectExperiences: snapshot.projectExperiences?.map((item) => ({
      ...item,
      startDate: sanitizeDateValue(item.startDate),
      endDate: sanitizeDateValue(item.endDate),
      techStack: sanitizeTokenList(item.techStack),
    })),
  };
}

export function assessResumeTextQuality(text: string): ResumeTextQualityReport {
  const privateUseGlyphCount = countMatches(text, /[\uE000-\uF8FF]/gu);
  const malformedDateCount = countMatches(
    text,
    /(?:^|[\s(])(?:[./\\-]{1,3}\d[./\\-]{1,3}\d|\d?[./\\-]{1,3}\d[./\\-]{1,3}[–-]?)(?=$|[\s)])/g,
  );
  const suspiciousTokenCount = text
    .split(/\s+/)
    .filter((token) => isLikelyCorruptedToken(token)).length;

  const reasons: string[] = [];

  if (privateUseGlyphCount > 0) {
    reasons.push("文本中包含 PDF 图标字体或私有区字符，说明抽取结果被污染。");
  }

  if (malformedDateCount > 0) {
    reasons.push("文本中存在异常日期片段，原始时间信息可能在抽取时受损。");
  }

  if (suspiciousTokenCount >= 3) {
    reasons.push(
      "文本中存在多处疑似乱码/损坏关键词，应降低基于原文细节的判断置信度。",
    );
  }

  return {
    isLowConfidence: reasons.length > 0,
    reasons,
    privateUseGlyphCount,
    suspiciousTokenCount,
    malformedDateCount,
  };
}

function hasMeaningfulEducation(snapshot: ResumeSnapshot) {
  return Boolean(
    snapshot.education &&
      [
        snapshot.education.school,
        snapshot.education.major,
        snapshot.education.degree,
      ].some(hasNonEmptyString),
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
  const qualityReport = assessResumeTextQuality(text);
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
          isLowConfidence: qualityReport.isLowConfidence,
          qualityReasons: qualityReport.reasons,
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
      content: [
        "你是专业的中文简历结构化解析助手。请严格按 schema 提取信息，缺失字段返回 null 或空数组，不要虚构经历。",
        "如果原文存在 PDF/OCR 抽取噪声，请优先保证字段干净，不要把疑似乱码、损坏日期、图标字符直接写入结构化结果。",
        "对明显损坏的技能词、时间字段、技术名：只有在你高度确定原词时才做保守归一化，否则返回 null 或省略该项。",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        "请解析这份简历。",
        qualityReport.isLowConfidence
          ? `文本提取质量提醒：${qualityReport.reasons.join("；")}`
          : "文本提取质量正常。",
        "",
        text,
      ].join("\n"),
    },
  ]);
  logLlmStep("resume-snapshot", "structured snapshot analysis completed", {
    durationMs: Date.now() - startedAt,
    isLowConfidence: qualityReport.isLowConfidence,
  });
  return sanitizeResumeSnapshot(resumeSnapshotSchema.parse(result));
}

export function buildJobTracingContext(input: {
  userId: string;
  jobId: string;
  jobType:
    | "questioning"
    | "resume-review"
    | "job-recommendation"
    | "resume-generation";
  resumeStoragePath?: string;
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
      const qualityReport = assessResumeTextQuality(existing.parsedText);
      logLlmStep("resume-snapshot", "reuse cached snapshot", {
        userId,
        storagePath,
        durationMs: Date.now() - startedAt,
        isLowConfidence: qualityReport.isLowConfidence,
      });
      return {
        record: existing,
        snapshot: cachedSnapshot,
        qualityReport,
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
  let fileName =
    existing?.fileName ?? storagePath.split("/").pop() ?? "resume.pdf";

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
  const qualityReport = assessResumeTextQuality(text);

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
    qualityReport,
  };
}

export function getCapabilityModelInfo(input?: {
  envModelKey?: string;
  useCase?: AiUseCase;
  userTier?: AiUserTier;
}) {
  return getModelConfig(input);
}

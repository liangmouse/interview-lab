import { z } from "zod";
import {
  createLangChainChatModel,
  createLangChainChatModelForUseCase,
  mergeLangfuseTracingContext,
  type LangfuseTracingContext,
} from "@interviewclaw/ai-runtime";
import {
  claimNextJobRecommendationJob,
  completeJobRecommendationJob,
  failJobRecommendationJob,
  getJobSourceSessionWithCredentialForUser,
  listJobRecommendationFeedbackForUser,
  loadLatestResumeRecordForUser,
  loadRecommendationProfileVectorsForUser,
  loadRecommendationUserProfile,
  type RecommendationProfileVectorDocument,
  type RecommendationUserProfile,
} from "@interviewclaw/data-access";
import type {
  InferredJobQuery,
  JobRecommendationJob,
  JobSearchPreferences,
  RecommendedJob,
  ResumeRecord,
} from "@interviewclaw/domain";
import { JOB_RECOMMENDATION_CONFIG } from "@interviewclaw/domain";
import {
  BossRateLimitError,
  BossSessionInvalidError,
  BossUpstreamError,
  fetchBossRecommendedJobs,
  searchBossJobs,
  type BossJobCandidate,
} from "./boss-provider";
import {
  buildJobTracingContext,
  ensureResumeSnapshot,
  getCapabilityModelInfo,
  type ResumeSnapshot,
} from "./shared";

const inferredQuerySchema = z.object({
  cities: z.array(z.string()).default([]),
  salaryRange: z
    .object({
      minK: z.number().int().positive().optional(),
      maxK: z.number().int().positive().optional(),
    })
    .optional(),
  role: z.string().optional(),
  industries: z.array(z.string()).default([]),
  companySizes: z.array(z.string()).default([]),
  reasoning: z.array(z.string()).min(1).max(5),
});

const rerankSchema = z.object({
  summary: z.string(),
  jobs: z.array(
    z.object({
      sourceJobId: z.string(),
      matchScore: z.number().min(0).max(100),
      matchReasons: z.array(z.string()).min(1).max(4),
      cautions: z.array(z.string()).max(3).default([]),
    }),
  ),
});

type RecommendationPreparation = {
  profile: RecommendationUserProfile | null;
  savedPreferenceSnapshot?: JobSearchPreferences;
  latestResumeRecord: ResumeRecord | null;
  latestResumeSnapshot: ResumeSnapshot | null;
  vectorDocuments: RecommendationProfileVectorDocument[];
};

function normalizeText(value?: string | null) {
  return value?.trim() ?? "";
}

function normalizeStringArray(values: string[] | null | undefined) {
  return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

function normalizeJobSearchPreferences(
  value?: Partial<JobSearchPreferences> | null,
): JobSearchPreferences {
  return {
    cities: normalizeStringArray(value?.cities),
    salaryMinK:
      typeof value?.salaryMinK === "number" ? value.salaryMinK : undefined,
    salaryMaxK:
      typeof value?.salaryMaxK === "number" ? value.salaryMaxK : undefined,
    role: normalizeText(value?.role) || undefined,
    industries: normalizeStringArray(value?.industries),
    companySizes: normalizeStringArray(value?.companySizes),
  };
}

function inferredQueryToPreferences(
  query: InferredJobQuery,
): JobSearchPreferences {
  return normalizeJobSearchPreferences({
    cities: query.cities,
    salaryMinK: query.salaryRange?.minK,
    salaryMaxK: query.salaryRange?.maxK,
    role: query.role,
    industries: query.industries,
    companySizes: query.companySizes,
  });
}

function summarizeWorkExperiences(snapshot: ResumeSnapshot | null) {
  if (!snapshot?.workExperiences?.length) {
    return "无明确工作经历";
  }

  return snapshot.workExperiences
    .slice(0, 3)
    .map((item) => {
      const company = normalizeText(item.company) || "未知公司";
      const position = normalizeText(item.position) || "未知岗位";
      const description = normalizeText(item.description);
      return `${company} / ${position}${description ? `：${description}` : ""}`;
    })
    .join("\n");
}

function summarizeProjectExperiences(snapshot: ResumeSnapshot | null) {
  if (!snapshot?.projectExperiences?.length) {
    return "无明确项目经历";
  }

  return snapshot.projectExperiences
    .slice(0, 3)
    .map((item) => {
      const projectName = normalizeText(item.projectName) || "未知项目";
      const role = normalizeText(item.role);
      const techStack = normalizeStringArray(item.techStack || []);
      const description = normalizeText(item.description);
      return [
        `${projectName}${role ? ` / ${role}` : ""}`,
        techStack.length > 0 ? `技术栈：${techStack.join("、")}` : "",
        description ? `项目描述：${description}` : "",
      ]
        .filter(Boolean)
        .join("；");
    })
    .join("\n");
}

function buildBackgroundSummary(input: RecommendationPreparation) {
  const skills = Array.from(
    new Set([
      ...normalizeStringArray(input.profile?.skills),
      ...normalizeStringArray(input.latestResumeSnapshot?.skills),
      ...((input.latestResumeSnapshot?.projectExperiences ?? []).flatMap(
        (item) => normalizeStringArray(item.techStack || []),
      ) ?? []),
    ]),
  );
  const vectorHighlights = input.vectorDocuments
    .slice(0, 4)
    .map((item) => `- ${item.content}`)
    .join("\n");

  return [
    `求职意向：${input.profile?.jobIntention || input.latestResumeSnapshot?.jobIntention || "未填写"}`,
    `目标公司：${input.profile?.companyIntention || "未填写"}`,
    `工作年限：${input.profile?.experienceYears ?? input.latestResumeSnapshot?.experienceYears ?? "未填写"}`,
    `技能关键词：${skills.length > 0 ? skills.join("、") : "未提取到"}`,
    `已保存偏好：${JSON.stringify(input.savedPreferenceSnapshot ?? normalizeJobSearchPreferences(), null, 2)}`,
    `工作经历摘要：\n${summarizeWorkExperiences(input.latestResumeSnapshot)}`,
    `项目经历摘要：\n${summarizeProjectExperiences(input.latestResumeSnapshot)}`,
    vectorHighlights
      ? `画像向量摘要：\n${vectorHighlights}`
      : "画像向量摘要：无",
  ].join("\n\n");
}

function buildAutoInferenceFallback(
  input: RecommendationPreparation,
): InferredJobQuery {
  const preferences = normalizeJobSearchPreferences(
    input.savedPreferenceSnapshot,
  );

  return {
    cities: preferences.cities,
    salaryRange:
      preferences.salaryMinK || preferences.salaryMaxK
        ? {
            minK: preferences.salaryMinK,
            maxK: preferences.salaryMaxK,
          }
        : undefined,
    role:
      preferences.role ||
      input.profile?.jobIntention ||
      input.latestResumeSnapshot?.jobIntention ||
      undefined,
    industries: preferences.industries,
    companySizes: preferences.companySizes,
    reasoning: [
      "优先使用已保存求职偏好作为基础筛选条件。",
      "当偏好缺失时，回退到用户画像和最近一次简历解析结果。",
    ],
  };
}

async function inferAutoQuery(input: {
  preparation: RecommendationPreparation;
  tracing?: LangfuseTracingContext;
}) {
  const fallback = buildAutoInferenceFallback(input.preparation);
  const explicitModel = process.env.JOB_RECOMMENDATION_MODEL?.trim();
  const model = (
    explicitModel
      ? createLangChainChatModel({
          model: explicitModel,
          temperature: 0.1,
          maxTokens: 3000,
          tracing: input.tracing,
        })
      : createLangChainChatModelForUseCase({
          useCase: "report-generate",
          temperature: 0.1,
          maxTokens: 3000,
          tracing: input.tracing,
        })
  ).withStructuredOutput(inferredQuerySchema, {
    method: "functionCalling",
  });

  try {
    return inferredQuerySchema.parse(
      await model.invoke([
        {
          role: "system",
          content:
            "你是求职岗位推荐助手。请根据用户画像、最近简历解析、已保存偏好，推断最合理的岗位筛选条件。缺失字段不要瞎编，直接留空。城市最多 3 个，行业最多 3 个，公司规模最多 3 个。",
        },
        {
          role: "user",
          content: buildBackgroundSummary(input.preparation),
        },
      ]),
    );
  } catch (error) {
    console.warn("[job-recommendation-worker] auto query inference fallback", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return fallback;
  }
}

function parseSalaryRangeK(text?: string) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/(\d+)\s*-\s*(\d+)\s*K/i);
  if (match) {
    return {
      minK: Number(match[1]),
      maxK: Number(match[2]),
    };
  }

  const single = normalized.match(/(\d+)\s*K/i);
  if (single) {
    const value = Number(single[1]);
    return {
      minK: value,
      maxK: value,
    };
  }

  return null;
}

function overlapsSalary(filters: JobSearchPreferences, salaryText?: string) {
  if (!filters.salaryMinK && !filters.salaryMaxK) {
    return true;
  }

  const range = parseSalaryRangeK(salaryText);
  if (!range) {
    return false;
  }

  const minExpected = filters.salaryMinK ?? 0;
  const maxExpected = filters.salaryMaxK ?? Number.MAX_SAFE_INTEGER;

  return range.maxK >= minExpected && range.minK <= maxExpected;
}

function includesAnyKeyword(value: string | undefined, expected: string[]) {
  if (!value) {
    return expected.length === 0;
  }

  if (expected.length === 0) {
    return true;
  }

  const haystack = value.toLowerCase();
  return expected.some((item) => haystack.includes(item.toLowerCase()));
}

function jobMatchesHardFilters(
  job: BossJobCandidate,
  filters: JobSearchPreferences,
) {
  if (!includesAnyKeyword(job.title, filters.role ? [filters.role] : [])) {
    return false;
  }

  if (!includesAnyKeyword(job.city, filters.cities)) {
    return false;
  }

  if (!includesAnyKeyword(job.industry, filters.industries)) {
    return false;
  }

  if (!includesAnyKeyword(job.companySize, filters.companySizes)) {
    return false;
  }

  if (!overlapsSalary(filters, job.salaryText)) {
    return false;
  }

  return true;
}

function buildCandidateKeywords(preparation: RecommendationPreparation) {
  return Array.from(
    new Set(
      [
        ...normalizeStringArray(preparation.profile?.skills),
        ...normalizeStringArray(preparation.latestResumeSnapshot?.skills),
        normalizeText(preparation.profile?.jobIntention),
        normalizeText(preparation.profile?.companyIntention),
        normalizeText(preparation.latestResumeSnapshot?.jobIntention),
        ...((
          preparation.latestResumeSnapshot?.projectExperiences ?? []
        ).flatMap((item) => normalizeStringArray(item.techStack || [])) ?? []),
      ].filter(Boolean),
    ),
  );
}

function scoreJobRuleBased(input: {
  job: BossJobCandidate;
  filters: JobSearchPreferences;
  preparation: RecommendationPreparation;
}) {
  let score = 45;
  const reasons: string[] = [];
  const cautions: string[] = [];
  const candidateKeywords = buildCandidateKeywords(input.preparation);
  const title = input.job.title.toLowerCase();
  const tagsText = input.job.tags.join(" ").toLowerCase();

  if (input.filters.role && title.includes(input.filters.role.toLowerCase())) {
    score += 18;
    reasons.push(`岗位名称直接命中目标岗位“${input.filters.role}”`);
  }

  if (
    input.filters.cities.length > 0 &&
    input.job.city &&
    input.filters.cities.some((city) =>
      input.job.city?.toLowerCase().includes(city.toLowerCase()),
    )
  ) {
    score += 10;
    reasons.push(`城市与偏好匹配：${input.job.city}`);
  }

  if (
    input.filters.industries.length > 0 &&
    input.job.industry &&
    input.filters.industries.some((industry) =>
      input.job.industry?.toLowerCase().includes(industry.toLowerCase()),
    )
  ) {
    score += 8;
    reasons.push(`行业方向匹配：${input.job.industry}`);
  }

  if (
    input.filters.companySizes.length > 0 &&
    input.job.companySize &&
    input.filters.companySizes.some((size) =>
      input.job.companySize?.toLowerCase().includes(size.toLowerCase()),
    )
  ) {
    score += 8;
    reasons.push(`公司规模接近偏好：${input.job.companySize}`);
  }

  if (overlapsSalary(input.filters, input.job.salaryText)) {
    score += 12;
    if (input.filters.salaryMinK || input.filters.salaryMaxK) {
      reasons.push(`薪资区间与期望有重叠：${input.job.salaryText}`);
    }
  } else if (input.filters.salaryMinK || input.filters.salaryMaxK) {
    cautions.push(
      `薪资区间可能不满足期望：${input.job.salaryText ?? "未标注"}`,
    );
  }

  const matchedKeywords = candidateKeywords.filter((keyword) => {
    const normalized = keyword.toLowerCase();
    return (
      normalized &&
      (title.includes(normalized) || tagsText.includes(normalized))
    );
  });

  if (matchedKeywords.length > 0) {
    score += Math.min(20, matchedKeywords.length * 5);
    reasons.push(
      `技能/经历关键词命中：${matchedKeywords.slice(0, 4).join("、")}`,
    );
  }

  if (!input.job.url) {
    cautions.push("职位原始链接缺失，后续查看时可能需要重新搜索。");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons: reasons.length > 0 ? reasons : ["与当前求职方向存在基础匹配"],
    cautions,
  };
}

function dedupeCandidates(jobs: BossJobCandidate[]) {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    if (seen.has(job.sourceJobId)) {
      return false;
    }
    seen.add(job.sourceJobId);
    return true;
  });
}

async function rerankRecommendedJobs(input: {
  shortlist: Array<
    RecommendedJob & { ruleReasons: string[]; ruleCautions: string[] }
  >;
  preparation: RecommendationPreparation;
  filters: JobSearchPreferences;
  tracing?: LangfuseTracingContext;
}) {
  if (input.shortlist.length === 0) {
    return {
      summary: "当前筛选条件下未检索到可推荐岗位。",
      jobs: [] as RecommendedJob[],
    };
  }

  const explicitModel = process.env.JOB_RECOMMENDATION_MODEL?.trim();
  const model = (
    explicitModel
      ? createLangChainChatModel({
          model: explicitModel,
          temperature: 0.2,
          maxTokens: 5000,
          tracing: input.tracing,
        })
      : createLangChainChatModelForUseCase({
          useCase: "report-generate",
          temperature: 0.2,
          maxTokens: 5000,
          tracing: input.tracing,
        })
  ).withStructuredOutput(rerankSchema, {
    method: "functionCalling",
  });

  try {
    const result = await model.invoke([
      {
        role: "system",
        content:
          "你是岗位推荐助手。请基于用户背景和候选职位 shortlist，对每个职位给出 0-100 匹配分、1-4 条推荐理由、最多 3 条风险提示，并输出一段整体推荐总结。不要编造职位字段，必须使用传入的 sourceJobId。",
      },
      {
        role: "user",
        content: [
          `用户背景：\n${buildBackgroundSummary(input.preparation)}`,
          `筛选条件：${JSON.stringify(input.filters, null, 2)}`,
          `候选岗位 shortlist：${JSON.stringify(
            input.shortlist.map((job) => ({
              sourceJobId: job.sourceJobId,
              title: job.title,
              companyName: job.companyName,
              city: job.city,
              salaryText: job.salaryText,
              industry: job.industry,
              companySize: job.companySize,
              experience: job.experience,
              degree: job.degree,
              tags: job.tags,
              ruleReasons: job.ruleReasons,
              ruleCautions: job.ruleCautions,
            })),
            null,
            2,
          )}`,
        ].join("\n\n"),
      },
    ]);

    const reranked = rerankSchema.parse(result);
    const rerankMap = new Map(
      reranked.jobs.map((job) => [job.sourceJobId, job]),
    );

    return {
      summary: reranked.summary,
      jobs: input.shortlist
        .map((job) => {
          const rerank = rerankMap.get(job.sourceJobId);
          return {
            ...job,
            matchScore: rerank?.matchScore ?? job.matchScore,
            matchReasons: rerank?.matchReasons ?? job.ruleReasons,
            cautions: rerank?.cautions ?? job.ruleCautions,
          };
        })
        .sort((left, right) => right.matchScore - left.matchScore)
        .slice(0, JOB_RECOMMENDATION_CONFIG.targetJobCount),
    };
  } catch (error) {
    console.warn("[job-recommendation-worker] rerank fallback", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      summary: "已基于岗位条件、技能命中和薪资区间完成首轮推荐排序。",
      jobs: input.shortlist
        .map((job) => ({
          ...job,
          matchReasons: job.ruleReasons,
          cautions: job.ruleCautions,
        }))
        .sort((left, right) => right.matchScore - left.matchScore)
        .slice(0, JOB_RECOMMENDATION_CONFIG.targetJobCount),
    };
  }
}

async function prepareRecommendationContext(
  job: JobRecommendationJob,
): Promise<RecommendationPreparation> {
  const [profile, latestResumeRecord, vectorDocuments] = await Promise.all([
    loadRecommendationUserProfile(job.userId),
    loadLatestResumeRecordForUser(job.userId),
    loadRecommendationProfileVectorsForUser(job.userId),
  ]);

  let latestResumeSnapshot: ResumeSnapshot | null = null;
  if (latestResumeRecord?.storagePath) {
    try {
      const { snapshot } = await ensureResumeSnapshot(
        job.userId,
        latestResumeRecord.storagePath,
      );
      latestResumeSnapshot = snapshot;
    } catch (error) {
      console.warn("[job-recommendation-worker] resume snapshot skipped", {
        userId: job.userId,
        jobId: job.id,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return {
    profile,
    savedPreferenceSnapshot:
      job.payload.savedPreferenceSnapshot ?? profile?.jobSearchPreferences,
    latestResumeRecord,
    latestResumeSnapshot,
    vectorDocuments,
  };
}

function resolveEffectiveQuery(input: {
  job: JobRecommendationJob;
  preparation: RecommendationPreparation;
  inferredQuery?: InferredJobQuery;
}) {
  if (input.job.payload.mode === "manual") {
    const manualFilters = normalizeJobSearchPreferences(
      input.job.payload.manualFilters,
    );
    return {
      inferredQuery: {
        cities: manualFilters.cities,
        salaryRange:
          manualFilters.salaryMinK || manualFilters.salaryMaxK
            ? {
                minK: manualFilters.salaryMinK,
                maxK: manualFilters.salaryMaxK,
              }
            : undefined,
        role: manualFilters.role,
        industries: manualFilters.industries,
        companySizes: manualFilters.companySizes,
        reasoning: ["使用用户手动填写的筛选条件作为硬过滤。"],
      },
      filters: manualFilters,
    };
  }

  const inferred =
    input.inferredQuery ?? buildAutoInferenceFallback(input.preparation);
  return {
    inferredQuery: inferred,
    filters: inferredQueryToPreferences(inferred),
  };
}

async function collectBossCandidates(input: {
  filters: JobSearchPreferences;
  credential: { cookie: string };
}) {
  const recommended = await fetchBossRecommendedJobs({
    credential: input.credential,
    limit: 20,
  });
  const shouldSearchMore =
    recommended.filter((job) => jobMatchesHardFilters(job, input.filters))
      .length < JOB_RECOMMENDATION_CONFIG.targetJobCount;

  if (!shouldSearchMore) {
    return recommended;
  }

  const searched = await searchBossJobs({
    credential: input.credential,
    query: input.filters,
    limit: 30,
  }).catch((error) => {
    if (error instanceof BossSessionInvalidError) {
      throw error;
    }
    if (error instanceof BossRateLimitError) {
      throw error;
    }
    if (error instanceof BossUpstreamError) {
      console.warn("[job-recommendation-worker] boss search fallback failed", {
        message: error.message,
      });
      return [];
    }
    throw error;
  });

  return dedupeCandidates([...recommended, ...searched]);
}

function isRetryableJobRecommendationError(error: unknown) {
  if (error instanceof BossSessionInvalidError) {
    return false;
  }

  if (error instanceof BossRateLimitError) {
    return true;
  }

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

export async function runOneJobRecommendationJob() {
  const claimStartedAt = Date.now();
  const job = await claimNextJobRecommendationJob();
  if (!job) {
    return null;
  }

  console.info("[job-recommendation-worker] claimed job", {
    jobId: job.id,
    userId: job.userId,
    mode: job.payload.mode,
    claimDurationMs: Date.now() - claimStartedAt,
  });

  const { providerId, model } = getCapabilityModelInfo({
    envModelKey: "JOB_RECOMMENDATION_MODEL",
    useCase: "report-generate",
  });
  const preparation = await prepareRecommendationContext(job);
  const tracing = buildJobTracingContext({
    userId: job.userId,
    jobId: job.id,
    jobType: "job-recommendation",
    resumeStoragePath: preparation.latestResumeRecord?.storagePath,
    metadata: {
      mode: job.payload.mode,
      source: job.payload.source,
    },
  });

  try {
    const session = await getJobSourceSessionWithCredentialForUser(
      job.userId,
      job.payload.source,
    );

    if (!session) {
      throw new BossSessionInvalidError(
        "未检测到可用的 BOSS 登录态，请先导入 Cookie",
      );
    }

    if (session.status === "invalid") {
      throw new BossSessionInvalidError(
        session.validationError || "BOSS 登录态已失效，请重新导入 Cookie",
      );
    }

    const inferredQuery =
      job.payload.mode === "auto"
        ? await inferAutoQuery({
            preparation,
            tracing: mergeLangfuseTracingContext(
              {
                metadata: {
                  stage: "auto-query-inference",
                },
              },
              tracing,
            ),
          })
        : undefined;
    const { filters, inferredQuery: finalQuery } = resolveEffectiveQuery({
      job,
      preparation,
      inferredQuery,
    });

    const hiddenOrRejected = new Set(
      (
        await listJobRecommendationFeedbackForUser({
          userId: job.userId,
          source: job.payload.source,
        })
      )
        .filter(
          (item) =>
            item.action === "hidden" || item.action === "not_interested",
        )
        .map((item) => item.sourceJobId),
    );

    const candidates = (
      await collectBossCandidates({
        filters,
        credential: session.credential,
      })
    )
      .filter((candidate) => !hiddenOrRejected.has(candidate.sourceJobId))
      .filter((candidate) => jobMatchesHardFilters(candidate, filters));

    const shortlist = candidates
      .map((candidate) => {
        const rule = scoreJobRuleBased({
          job: candidate,
          filters,
          preparation,
        });
        return {
          ...candidate,
          matchScore: rule.score,
          matchReasons: rule.reasons,
          cautions: rule.cautions,
          ruleReasons: rule.reasons,
          ruleCautions: rule.cautions,
        };
      })
      .sort((left, right) => right.matchScore - left.matchScore)
      .slice(0, JOB_RECOMMENDATION_CONFIG.shortlistSize);

    const reranked = await rerankRecommendedJobs({
      shortlist,
      preparation,
      filters,
      tracing: mergeLangfuseTracingContext(
        {
          metadata: {
            stage: "rerank",
            shortlistSize: shortlist.length,
          },
        },
        tracing,
      ),
    });

    const result = {
      id: `job-recommendation:${job.id}`,
      mode: job.payload.mode,
      source: job.payload.source,
      createdAt: new Date().toISOString(),
      inferredQuery: finalQuery,
      summary:
        reranked.jobs.length > 0
          ? reranked.summary
          : "当前筛选条件下没有找到合适岗位，建议放宽城市、薪资或公司规模条件后重试。",
      jobs: reranked.jobs.map((jobItem) => ({
        sourceJobId: jobItem.sourceJobId,
        title: jobItem.title,
        companyName: jobItem.companyName,
        city: jobItem.city,
        salaryText: jobItem.salaryText,
        industry: jobItem.industry,
        companySize: jobItem.companySize,
        experience: jobItem.experience,
        degree: jobItem.degree,
        tags: jobItem.tags,
        url: jobItem.url,
        matchScore: jobItem.matchScore,
        matchReasons: jobItem.matchReasons,
        cautions: jobItem.cautions,
      })),
    } satisfies {
      id: string;
      mode: JobRecommendationJob["payload"]["mode"];
      source: JobRecommendationJob["payload"]["source"];
      createdAt: string;
      inferredQuery: InferredJobQuery;
      summary: string;
      jobs: RecommendedJob[];
    };

    await completeJobRecommendationJob({
      jobId: job.id,
      providerId,
      model,
      result,
    });

    console.info("[job-recommendation-worker] job completed", {
      jobId: job.id,
      resultCount: result.jobs.length,
    });
    return result;
  } catch (error) {
    console.error("[job-recommendation-worker] job failed", {
      jobId: job.id,
      message: error instanceof Error ? error.message : "unknown",
    });
    await failJobRecommendationJob({
      jobId: job.id,
      errorMessage:
        error instanceof Error ? error.message : "岗位推荐任务执行失败",
      providerId,
      model,
      terminal: !isRetryableJobRecommendationError(error),
    });
    return null;
  }
}

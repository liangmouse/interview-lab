import type {
  JobSearchPreferences,
  JobSourceSessionCredential,
  RecommendedJob,
} from "@interviewclaw/domain";

const DEFAULT_BOSS_BASE_URL =
  process.env.BOSS_BASE_URL?.trim() || "https://www.zhipin.com";
const DEFAULT_BOSS_RECOMMEND_PATH =
  process.env.BOSS_RECOMMEND_PATH?.trim() ||
  "/wapi/zpgeek/pc/recommend/job/list.json";
const DEFAULT_BOSS_SEARCH_PATH =
  process.env.BOSS_SEARCH_PATH?.trim() || "/wapi/zpgeek/search/joblist.json";
const DEFAULT_TIMEOUT_MS = 15_000;

export type BossJobCandidate = Omit<
  RecommendedJob,
  "matchScore" | "matchReasons" | "cautions"
>;

export class BossSessionInvalidError extends Error {
  constructor(message = "BOSS 登录态失效，请重新导入 Cookie") {
    super(message);
    this.name = "BossSessionInvalidError";
  }
}

export class BossRateLimitError extends Error {
  constructor(message = "BOSS 请求过于频繁，请稍后重试") {
    super(message);
    this.name = "BossRateLimitError";
  }
}

export class BossUpstreamError extends Error {
  constructor(message = "BOSS 职位服务暂时不可用") {
    super(message);
    this.name = "BossUpstreamError";
  }
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeOptionalText(item))
    .filter((item): item is string => Boolean(item));
}

function getNestedValue(record: Record<string, unknown>, keyPath: string[]) {
  let current: unknown = record;

  for (const key of keyPath) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function resolveBossResponseCode(payload: Record<string, unknown>) {
  const codeCandidate = payload.code ?? payload.rescode ?? payload.status;
  if (typeof codeCandidate === "number") {
    return codeCandidate;
  }

  if (typeof codeCandidate === "string" && codeCandidate.trim()) {
    const parsed = Number(codeCandidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function resolveBossResponseMessage(payload: Record<string, unknown>) {
  return (
    normalizeOptionalText(payload.message) ||
    normalizeOptionalText(payload.msg) ||
    normalizeOptionalText(payload.errorMessage) ||
    ""
  );
}

function buildRequestHeaders(
  credential: JobSourceSessionCredential,
  refererPath: string,
) {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.9",
    "cache-control": "no-cache",
    cookie: credential.cookie,
    pragma: "no-cache",
    referer: `${DEFAULT_BOSS_BASE_URL}${refererPath}`,
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    "x-requested-with": "XMLHttpRequest",
  };
}

function joinUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl).toString();
}

async function fetchBossJson(input: {
  path: string;
  credential: JobSourceSessionCredential;
  query?: Record<string, string | number | undefined>;
  refererPath?: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(joinUrl(DEFAULT_BOSS_BASE_URL, input.path));
  for (const [key, value] of Object.entries(input.query ?? {})) {
    if (value !== undefined && `${value}`.trim()) {
      url.searchParams.set(key, `${value}`);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let response: Response;
  let rawText = "";

  try {
    response = await fetchImpl(url.toString(), {
      headers: buildRequestHeaders(
        input.credential,
        input.refererPath ?? "/web/geek/job",
      ),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    throw new BossUpstreamError(
      error instanceof Error ? error.message : "请求 BOSS 失败",
    );
  }

  clearTimeout(timer);

  if (response.status === 401 || response.status === 403) {
    throw new BossSessionInvalidError();
  }

  if (response.status === 429) {
    throw new BossRateLimitError();
  }

  rawText = await response.text();
  const normalizedText = rawText.trim();

  if (!response.ok) {
    throw new BossUpstreamError(
      normalizedText || `BOSS 接口返回异常状态码 ${response.status}`,
    );
  }

  if (
    /登录|验证码|行为验证|请先登录|security-check|robot/i.test(normalizedText)
  ) {
    if (/验证码|行为验证|security-check|robot/i.test(normalizedText)) {
      throw new BossRateLimitError();
    }
    throw new BossSessionInvalidError();
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(normalizedText) as Record<string, unknown>;
  } catch {
    throw new BossUpstreamError("BOSS 返回了非 JSON 数据");
  }

  const code = resolveBossResponseCode(payload);
  const message = resolveBossResponseMessage(payload);

  if (code !== 0) {
    if (/登录|未授权|请先登录/i.test(message)) {
      throw new BossSessionInvalidError(message || undefined);
    }

    if (/频繁|验证码|校验|限制|稍后/i.test(message)) {
      throw new BossRateLimitError(message || undefined);
    }

    throw new BossUpstreamError(message || `BOSS 返回异常 code=${code}`);
  }

  return payload;
}

function pickJobList(payload: Record<string, unknown>) {
  const candidates = [
    getNestedValue(payload, ["zpData", "jobList"]),
    getNestedValue(payload, ["zpData", "list"]),
    getNestedValue(payload, ["zpData", "jobs"]),
    payload.jobList,
    payload.list,
    getNestedValue(payload, ["data", "jobList"]),
    getNestedValue(payload, ["data", "list"]),
    getNestedValue(payload, ["data", "jobs"]),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as Record<string, unknown>[];
    }
  }

  return [];
}

function buildFallbackJobUrl(raw: Record<string, unknown>) {
  const securityId =
    normalizeOptionalText(raw.securityId) ||
    normalizeOptionalText(raw.encryptJobId) ||
    normalizeOptionalText(raw.jobId);

  if (!securityId) {
    return undefined;
  }

  return `${DEFAULT_BOSS_BASE_URL}/job_detail/${securityId}.html`;
}

function normalizeBossJob(
  raw: Record<string, unknown>,
): BossJobCandidate | null {
  const sourceJobId =
    normalizeOptionalText(raw.securityId) ||
    normalizeOptionalText(raw.encryptJobId) ||
    normalizeOptionalText(raw.jobId) ||
    normalizeOptionalText(raw.id);
  const title =
    normalizeOptionalText(raw.jobName) ||
    normalizeOptionalText(raw.jobTitle) ||
    normalizeOptionalText(raw.positionName) ||
    normalizeOptionalText(raw.title);
  const companyName =
    normalizeOptionalText(raw.brandName) ||
    normalizeOptionalText(raw.companyName) ||
    normalizeOptionalText(raw.company) ||
    normalizeOptionalText(raw.brand);

  if (!sourceJobId || !title || !companyName) {
    return null;
  }

  const tags = Array.from(
    new Set(
      [
        ...toStringArray(raw.jobLabels),
        ...toStringArray(raw.skills),
        ...toStringArray(raw.welfareList),
        ...toStringArray(raw.tags),
      ].filter(Boolean),
    ),
  );

  return {
    sourceJobId,
    title,
    companyName,
    city:
      normalizeOptionalText(raw.cityName) ||
      normalizeOptionalText(raw.locationName) ||
      normalizeOptionalText(raw.city),
    salaryText:
      normalizeOptionalText(raw.salaryDesc) ||
      normalizeOptionalText(raw.salary) ||
      normalizeOptionalText(raw.salaryName),
    industry:
      normalizeOptionalText(raw.brandIndustry) ||
      normalizeOptionalText(raw.industryName) ||
      normalizeOptionalText(raw.industry),
    companySize:
      normalizeOptionalText(raw.brandScaleName) ||
      normalizeOptionalText(raw.scaleName) ||
      normalizeOptionalText(raw.companyScale),
    experience:
      normalizeOptionalText(raw.jobExperience) ||
      normalizeOptionalText(raw.experienceName) ||
      normalizeOptionalText(raw.experience),
    degree:
      normalizeOptionalText(raw.jobDegree) ||
      normalizeOptionalText(raw.degreeName) ||
      normalizeOptionalText(raw.degree),
    tags,
    url:
      normalizeOptionalText(raw.jobUrl) ||
      normalizeOptionalText(raw.url) ||
      buildFallbackJobUrl(raw),
  };
}

function dedupeJobs(jobs: BossJobCandidate[]) {
  const seen = new Set<string>();
  const deduped: BossJobCandidate[] = [];

  for (const job of jobs) {
    if (seen.has(job.sourceJobId)) {
      continue;
    }
    seen.add(job.sourceJobId);
    deduped.push(job);
  }

  return deduped;
}

export async function validateBossSession(input: {
  credential: JobSourceSessionCredential;
  fetchImpl?: typeof fetch;
}) {
  await fetchBossJson({
    path: DEFAULT_BOSS_RECOMMEND_PATH,
    credential: input.credential,
    query: {
      page: 1,
      pageSize: 1,
    },
    fetchImpl: input.fetchImpl,
    refererPath: "/web/geek/job-recommend",
  });

  return {
    status: "connected" as const,
    lastValidatedAt: new Date().toISOString(),
  };
}

export async function fetchBossRecommendedJobs(input: {
  credential: JobSourceSessionCredential;
  limit?: number;
  fetchImpl?: typeof fetch;
}) {
  const payload = await fetchBossJson({
    path: DEFAULT_BOSS_RECOMMEND_PATH,
    credential: input.credential,
    query: {
      page: 1,
      pageSize: input.limit ?? 20,
    },
    fetchImpl: input.fetchImpl,
    refererPath: "/web/geek/job-recommend",
  });

  return dedupeJobs(
    pickJobList(payload)
      .map(normalizeBossJob)
      .filter(Boolean) as BossJobCandidate[],
  );
}

export async function searchBossJobs(input: {
  credential: JobSourceSessionCredential;
  query: JobSearchPreferences;
  limit?: number;
  fetchImpl?: typeof fetch;
}) {
  const payload = await fetchBossJson({
    path: DEFAULT_BOSS_SEARCH_PATH,
    credential: input.credential,
    query: {
      page: 1,
      pageSize: input.limit ?? 30,
      query: input.query.role || input.query.industries[0] || "工程师",
      city: input.query.cities[0],
    },
    fetchImpl: input.fetchImpl,
    refererPath: "/web/geek/job",
  });

  return dedupeJobs(
    pickJobList(payload)
      .map(normalizeBossJob)
      .filter(Boolean) as BossJobCandidate[],
  );
}

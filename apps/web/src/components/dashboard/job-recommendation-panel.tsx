"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  JobRecommendationFeedbackAction,
  JobRecommendationJob,
  JobSourceSession,
  RecommendedJob,
} from "@interviewclaw/domain";
import { Link } from "@/i18n/navigation";
import { useUserStore } from "@/store/user";
import {
  createAutoJobRecommendation,
  createManualJobRecommendation,
  deleteBossSession,
  getBossSession,
  getJobRecommendationJob,
  listJobRecommendationJobs,
  saveBossSession,
  upsertJobRecommendationFeedback,
} from "@/lib/job-recommendations-client";
import {
  emptyJobRecommendationManualForm,
  manualFormToPreferences,
  validateJobRecommendationManualForm,
  type JobRecommendationManualFormErrors,
  type JobRecommendationManualFormValues,
} from "@/lib/job-recommendation-center";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ClipboardPaste,
  ExternalLink,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";

const POLL_INTERVAL_MS = 6000;

function isPendingJob(job: JobRecommendationJob) {
  return job.status === "queued" || job.status === "running";
}

function mergeJobs(
  currentJobs: JobRecommendationJob[],
  nextJobs: JobRecommendationJob[],
) {
  const nextMap = new Map(nextJobs.map((job) => [job.id, job]));
  const merged = currentJobs.map((job) => nextMap.get(job.id) ?? job);
  const existingIds = new Set(currentJobs.map((job) => job.id));

  for (const job of nextJobs) {
    if (!existingIds.has(job.id)) {
      merged.push(job);
    }
  }

  return merged;
}

function applyFeedbackToJobs(
  jobs: JobRecommendationJob[],
  sourceJobId: string,
  action: JobRecommendationFeedbackAction,
) {
  return jobs.map((job) => {
    if (!job.result) {
      return job;
    }

    if (action === "hidden" || action === "not_interested") {
      return {
        ...job,
        result: {
          ...job.result,
          jobs: job.result.jobs.filter(
            (item) => item.sourceJobId !== sourceJobId,
          ),
        },
      };
    }

    return job;
  });
}

function BossConnectionStep({
  step,
  title,
  description,
  tone = "default",
}: {
  step: string;
  title: string;
  description: string;
  tone?: "default" | "accent";
}) {
  return (
    <div
      className={
        tone === "accent"
          ? "rounded-2xl border border-[#CFE3D9] bg-[#F4FBF7] p-4"
          : "rounded-2xl border border-[#E8ECE9] bg-white p-4"
      }
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#173D31] text-sm font-semibold text-white">
          {step}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#173D31]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[#55665F]">{description}</p>
        </div>
      </div>
    </div>
  );
}

function BackgroundSummaryCard() {
  const { userInfo } = useUserStore();
  const skills = (userInfo?.skills ?? []).slice(0, 8);

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] p-4">
        <p className="text-xs text-[#6B7B74]">当前意向岗位</p>
        <p className="mt-2 text-sm font-medium text-[#141414]">
          {userInfo?.job_intention || "未填写"}
        </p>
      </div>
      <div className="rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] p-4">
        <p className="text-xs text-[#6B7B74]">目标公司</p>
        <p className="mt-2 text-sm font-medium text-[#141414]">
          {userInfo?.company_intention || "未填写"}
        </p>
      </div>
      <div className="rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] p-4">
        <p className="text-xs text-[#6B7B74]">工作年限</p>
        <p className="mt-2 text-sm font-medium text-[#141414]">
          {userInfo?.experience_years ?? "未填写"}
        </p>
      </div>
      <div className="rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] p-4">
        <p className="text-xs text-[#6B7B74]">技能关键词</p>
        <p className="mt-2 text-sm font-medium text-[#141414]">
          {skills.length > 0 ? skills.join("、") : "未填写"}
        </p>
      </div>
    </div>
  );
}

function RecommendationJobCard({
  job,
  onFeedback,
  pendingAction,
}: {
  job: RecommendedJob;
  onFeedback: (
    sourceJobId: string,
    action: JobRecommendationFeedbackAction,
    snapshot: RecommendedJob,
  ) => Promise<void>;
  pendingAction?: JobRecommendationFeedbackAction;
}) {
  return (
    <Card className="border-[#E8ECE9] bg-white">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-lg font-semibold text-[#141414]">
              {job.title}
            </CardTitle>
            <p className="text-sm text-[#4F5F58]">
              {job.companyName}
              {job.city ? ` · ${job.city}` : ""}
              {job.salaryText ? ` · ${job.salaryText}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#173D31] text-white">
              匹配度 {job.matchScore}
            </Badge>
            {job.url ? (
              <a
                href={job.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-[#1E5D47] underline underline-offset-4"
              >
                打开职位
              </a>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[job.industry, job.companySize, job.experience, job.degree]
            .filter(Boolean)
            .map((item) => (
              <Badge
                key={item}
                variant="outline"
                className="border-[#D8E6DE] bg-[#F8FBF9] text-[#315747]"
              >
                {item}
              </Badge>
            ))}
          {job.tags.map((item) => (
            <Badge
              key={item}
              variant="outline"
              className="border-[#E7ECE9] bg-white text-[#4F5F58]"
            >
              {item}
            </Badge>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] p-4">
            <p className="text-sm font-medium text-[#173D31]">推荐理由</p>
            <ul className="mt-3 space-y-2 text-sm leading-7 text-[#1E302A]">
              {job.matchReasons.map((reason) => (
                <li key={reason}>- {reason}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[#F0E5D9] bg-[#FFF9F3] p-4">
            <p className="text-sm font-medium text-[#8B5A24]">风险提示</p>
            <ul className="mt-3 space-y-2 text-sm leading-7 text-[#6A4B28]">
              {(job.cautions.length > 0
                ? job.cautions
                : ["当前未发现明显风险，可进一步手动核对 JD。"]
              ).map((reason) => (
                <li key={reason}>- {reason}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={pendingAction === "saved"}
            onClick={() => void onFeedback(job.sourceJobId, "saved", job)}
          >
            {pendingAction === "saved" ? "已收藏" : "收藏"}
          </Button>
          <Button
            variant="outline"
            disabled={pendingAction === "hidden"}
            onClick={() => void onFeedback(job.sourceJobId, "hidden", job)}
          >
            {pendingAction === "hidden" ? "已屏蔽" : "屏蔽"}
          </Button>
          <Button
            variant="outline"
            disabled={pendingAction === "not_interested"}
            onClick={() =>
              void onFeedback(job.sourceJobId, "not_interested", job)
            }
          >
            {pendingAction === "not_interested" ? "已标记不感兴趣" : "不感兴趣"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function JobRecommendationPanel() {
  const [jobs, setJobs] = useState<JobRecommendationJob[]>([]);
  const [session, setSession] = useState<JobSourceSession | null>(null);
  const [sessionCookie, setSessionCookie] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isSubmittingAuto, setIsSubmittingAuto] = useState(false);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualForm, setManualForm] =
    useState<JobRecommendationManualFormValues>(
      emptyJobRecommendationManualForm(),
    );
  const [manualErrors, setManualErrors] =
    useState<JobRecommendationManualFormErrors>({});
  const [feedbackState, setFeedbackState] = useState<
    Record<string, JobRecommendationFeedbackAction>
  >({});
  const [jobError, setJobError] = useState("");

  useEffect(() => {
    void Promise.all([getBossSession(), listJobRecommendationJobs()])
      .then(([loadedSession, loadedJobs]) => {
        setSession(loadedSession);
        setIsManualEntryOpen(Boolean(loadedSession?.validationError));
        setJobs(loadedJobs);
      })
      .catch((error) => {
        setJobError(
          error instanceof Error ? error.message : "加载岗位推荐失败",
        );
      });
  }, []);

  const pendingJobs = useMemo(() => jobs.filter(isPendingJob), [jobs]);

  useEffect(() => {
    if (pendingJobs.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void Promise.all(
        pendingJobs.map((job) =>
          getJobRecommendationJob(job.id).catch(() => null),
        ),
      ).then((results) => {
        const refreshed = results.filter(Boolean) as JobRecommendationJob[];
        if (refreshed.length === 0) {
          return;
        }
        setJobs((current) => mergeJobs(current, refreshed));
      });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [pendingJobs]);

  const latestSucceededJob = useMemo(
    () => jobs.find((job) => job.status === "succeeded" && job.result),
    [jobs],
  );

  const latestAutoResult = useMemo(
    () =>
      jobs.find(
        (job) =>
          job.status === "succeeded" &&
          job.payload.mode === "auto" &&
          job.result,
      )?.result ?? null,
    [jobs],
  );
  const canStartRecommendations = session?.status === "connected";

  async function handleSaveSession() {
    if (!sessionCookie.trim()) {
      setIsManualEntryOpen(true);
      setSessionError(
        "还没有检测到登录信息，请先复制完整内容，再回来点击连接并验证。",
      );
      return;
    }

    setIsSavingSession(true);
    setSessionError("");
    try {
      const saved = await saveBossSession(sessionCookie.trim());
      setSession(saved);
      setSessionCookie("");
      setIsManualEntryOpen(false);
    } catch (error) {
      setIsManualEntryOpen(true);
      setSessionError(
        error instanceof Error ? error.message : "连接 BOSS 账号失败",
      );
      const latest = await getBossSession().catch(() => null);
      setSession(latest);
    } finally {
      setIsSavingSession(false);
    }
  }

  async function handleDeleteSession() {
    setIsSavingSession(true);
    try {
      await deleteBossSession();
      setSession(null);
      setSessionError("");
    } finally {
      setIsSavingSession(false);
    }
  }

  async function handleCreateAutoJob() {
    setIsSubmittingAuto(true);
    setJobError("");
    try {
      const created = await createAutoJobRecommendation();
      setJobs((current) => [created, ...current]);
    } catch (error) {
      setJobError(
        error instanceof Error ? error.message : "自动推荐任务创建失败",
      );
    } finally {
      setIsSubmittingAuto(false);
    }
  }

  async function handleCreateManualJob() {
    const errors = validateJobRecommendationManualForm(manualForm);
    setManualErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSubmittingManual(true);
    setJobError("");
    try {
      const created = await createManualJobRecommendation({
        filters: manualFormToPreferences(manualForm),
        savePreferences: manualForm.savePreferences,
      });
      setJobs((current) => [created, ...current]);
    } catch (error) {
      setJobError(
        error instanceof Error ? error.message : "手动推荐任务创建失败",
      );
    } finally {
      setIsSubmittingManual(false);
    }
  }

  async function handleFeedback(
    sourceJobId: string,
    action: JobRecommendationFeedbackAction,
    snapshot: RecommendedJob,
  ) {
    setFeedbackState((current) => ({
      ...current,
      [sourceJobId]: action,
    }));
    setJobs((current) => applyFeedbackToJobs(current, sourceJobId, action));

    try {
      await upsertJobRecommendationFeedback({
        sourceJobId,
        action,
        jobSnapshot: snapshot,
      });
    } catch (error) {
      setJobError(error instanceof Error ? error.message : "职位反馈提交失败");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-[#E8ECE9] bg-white">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-[#141414]">
            连接 BOSS 账号
          </CardTitle>
          <CardDescription className="leading-7">
            为了生成更贴近你背景的岗位推荐，需要先连接你的 BOSS
            账号。我们只验证登录状态是否可用，不会回显你粘贴的原始内容。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[28px] border border-[#DCE7E2] bg-[linear-gradient(135deg,#F8FBF9_0%,#F4FAF7_52%,#EEF7F2_100%)] p-5">
            <div className="grid gap-5 lg:grid-cols-[1.25fr_0.95fr]">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#D7E5DE] bg-white/80 px-3 py-1 text-xs font-medium text-[#315747]">
                  <WandSparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  推荐方式
                </div>
                <div className="space-y-3">
                  <h3 className="text-[22px] font-semibold leading-8 text-[#173D31] text-balance">
                    三步完成连接，不需要先理解 Cookie 是什么
                  </h3>
                  <p className="max-w-2xl text-sm leading-7 text-[#52615B]">
                    你只需要在浏览器里保持 BOSS
                    已登录，按下面步骤复制登录信息，然后回来验证。高级方式仍然保留，默认先隐藏。
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <BossConnectionStep
                    step="1"
                    title="先确认已登录"
                    description="在浏览器里打开 BOSS 网页版，确认页面右上角已经是你的账号状态。"
                  />
                  <BossConnectionStep
                    step="2"
                    title="复制登录信息"
                    description="按教程复制浏览器里的登录信息，整段复制，不需要自己筛字段。"
                  />
                  <BossConnectionStep
                    step="3"
                    title="回来验证连接"
                    description="回到这里粘贴并点击连接，系统会立即校验是否还能正常读取职位。"
                    tone="accent"
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-[#D5E4DD] bg-white/90 p-5 shadow-[0_18px_50px_rgba(23,61,49,0.06)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#173D31] text-white">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-[#173D31]">
                      连接边界
                    </p>
                    <ul className="space-y-2 text-sm leading-6 text-[#55665F]">
                      <li>
                        - 当前连接只服务于岗位推荐流程，不用于别的页面能力。
                      </li>
                      <li>
                        - 不会在前台展示你粘贴的原始内容，也不会让其他用户看到。
                      </li>
                      <li>- 连接失效后你可以随时重新连接或删除连接。</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={() => setIsManualEntryOpen(true)}
                    className="min-w-[148px]"
                  >
                    我已复制，去粘贴
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsGuideOpen((current) => !current)}
                    aria-expanded={isGuideOpen}
                  >
                    详细操作步骤
                    <ChevronDown
                      className={`ml-2 h-4 w-4 transition-transform ${
                        isGuideOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              </div>
            </div>

            {isGuideOpen ? (
              <div className="mt-5 rounded-3xl border border-[#D6E6DE] bg-white/85 p-5">
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-[#173D31]">
                      详细操作步骤
                    </p>
                    <ol className="space-y-2 text-sm leading-7 text-[#52615B]">
                      <li>1. 打开 BOSS 网页版并完成登录，保持页面不要退出。</li>
                      <li>
                        2. 在浏览器里打开开发者工具，进入 Application 或 Storage
                        里的 Cookies。
                      </li>
                      <li>
                        3. 复制当前站点下的完整 Cookie 内容，不要手动删改。
                      </li>
                      <li>4. 回到这里粘贴，点击“连接并验证”。</li>
                    </ol>
                  </div>
                  <div className="rounded-2xl border border-[#E8ECE9] bg-[#F7FAF8] p-4">
                    <div className="flex items-start gap-3">
                      <LockKeyhole
                        className="mt-0.5 h-4 w-4 text-[#173D31]"
                        aria-hidden="true"
                      />
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-[#173D31]">
                          操作提示
                        </p>
                        <p className="text-sm leading-6 text-[#55665F]">
                          如果你愿意提供 2-3
                          张当前浏览器操作截图，我可以再把这里改成真正的图文教程样式。
                        </p>
                        <a
                          href="https://www.zhipin.com"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-sm font-medium text-[#1E5D47] underline underline-offset-4"
                        >
                          打开 BOSS 网页版
                          <ExternalLink
                            className="ml-1 h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-[#E6ECE8] bg-[#FBFCFB] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF5F1] text-[#173D31]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#173D31]">
                  你最关心的事
                </p>
                <p className="text-sm leading-6 text-[#55665F]">
                  这段登录信息确实敏感，所以这里把边界说清楚。我们希望用户是在理解用途后，再决定是否连接。
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[#DCE7E2] bg-white p-4">
                <p className="text-sm font-semibold text-[#173D31]">
                  当前会做什么
                </p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-[#55665F]">
                  <li>- 校验你的 BOSS 登录状态是否仍然可用。</li>
                  <li>- 在你主动开始推荐时，读取职位推荐所需的受限会话。</li>
                  <li>- 在你删除连接或连接失效前，维持这段受限连接。</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-[#F0E5D9] bg-[#FFF9F3] p-4">
                <p className="text-sm font-semibold text-[#8B5A24]">
                  当前不会做什么
                </p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-[#6A4B28]">
                  <li>- 不会自动投递职位。</li>
                  <li>- 不会自动发消息、打招呼或改你的资料。</li>
                  <li>- 不会在页面上回显你粘贴的原始内容。</li>
                </ul>
              </div>

              <div className="rounded-2xl border border-[#E8ECE9] bg-white p-4">
                <p className="text-sm font-semibold text-[#173D31]">
                  你掌控什么
                </p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-[#55665F]">
                  <li>- 你可以随时点“删除连接”立即断开。</li>
                  <li>- 连接失效后，系统会明确提示你重新连接。</li>
                  <li>
                    -
                    如果你暂时不放心，可以先不要连接，等我们后续做更轻量的一键方案。
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-[#E8ECE9] bg-white p-4">
                <p className="text-sm font-semibold text-[#173D31]">
                  为什么现在还需要这一步
                </p>
                <p className="mt-2 text-sm leading-6 text-[#55665F]">
                  现阶段推荐能力依赖 BOSS
                  网页登录态来验证可读性。这不是最理想的方案，所以我们把它做成显式连接，而不是静默采集。
                </p>
              </div>
            </div>
          </div>

          {session ? (
            <div
              className={`rounded-2xl border p-4 ${
                session.status === "connected"
                  ? "border-[#D8E6DE] bg-[#FAFCFB]"
                  : "border-[#F1DDCF] bg-[#FFF8F2]"
              }`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        session.status === "connected"
                          ? "bg-[#173D31] text-white"
                          : "bg-[#A14D2A] text-white"
                      }
                    >
                      {session.status === "connected" ? "已连接" : "已失效"}
                    </Badge>
                    {session.status === "connected" ? (
                      <CheckCircle2
                        className="h-4 w-4 text-[#1E5D47]"
                        aria-hidden="true"
                      />
                    ) : (
                      <TriangleAlert
                        className="h-4 w-4 text-[#A14D2A]"
                        aria-hidden="true"
                      />
                    )}
                    {session.lastValidatedAt ? (
                      <span className="text-sm text-[#5F6B66]">
                        最近校验：{formatDateTime(session.lastValidatedAt)}
                      </span>
                    ) : null}
                  </div>
                  {session.validationError ? (
                    <p className="text-sm text-[#A14D2A]">
                      {session.validationError}
                    </p>
                  ) : (
                    <p className="text-sm text-[#315747]">
                      已连接成功，下面可以直接开始岗位推荐。
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {session.status === "connected" ? (
                    <Button asChild>
                      <Link href="#start-recommendation">开始推荐</Link>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => setIsManualEntryOpen(true)}
                    >
                      重新连接
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => void handleDeleteSession()}
                    disabled={isSavingSession}
                  >
                    删除连接
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-dashed border-[#D6E3DC] bg-[#FCFDFC] p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 text-left"
              onClick={() => setIsManualEntryOpen((current) => !current)}
              aria-expanded={isManualEntryOpen}
            >
              <div>
                <p className="text-sm font-semibold text-[#173D31]">高级方式</p>
                <p className="mt-1 text-sm leading-6 text-[#5A6A63]">
                  如果你已经拿到完整登录信息，可以直接在这里粘贴并验证。
                </p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-[#5A6A63] transition-transform ${
                  isManualEntryOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {isManualEntryOpen ? (
              <div className="mt-4 space-y-3 border-t border-[#E8ECE9] pt-4">
                <label
                  htmlFor="boss-session-cookie"
                  className="flex items-center gap-2 text-sm font-medium text-[#173D31]"
                >
                  <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
                  粘贴登录信息
                </label>
                <Textarea
                  id="boss-session-cookie"
                  name="boss-session-cookie"
                  value={sessionCookie}
                  onChange={(event) => setSessionCookie(event.target.value)}
                  placeholder="把从浏览器复制的完整登录信息粘贴到这里…"
                  className="min-h-28"
                  aria-label="粘贴登录信息"
                />
                {sessionError ? (
                  <p className="text-sm text-[#A14D2A]" aria-live="polite">
                    {sessionError}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-[#5F6B66]">
                      粘贴后点击连接并验证，系统会立刻判断当前登录状态是否可用。
                    </p>
                    <p className="text-xs leading-6 text-[#6B7B74]">
                      这段信息当前只会用于校验登录状态和岗位推荐，不会自动触发投递、发消息或修改资料。
                    </p>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    onClick={() => void handleSaveSession()}
                    disabled={isSavingSession}
                  >
                    {isSavingSession
                      ? "连接验证中…"
                      : session
                        ? "更新连接并验证"
                        : "连接并验证"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card
        id="start-recommendation"
        className="border-[#E8ECE9] bg-white scroll-mt-24"
      >
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-[#141414]">
            开始推荐
          </CardTitle>
          <CardDescription>
            自动模式会读取你的用户画像和最近简历；手动模式按你填写的筛选条件做硬过滤。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="auto">
            <TabsList className="mb-6">
              <TabsTrigger value="auto">自动推荐</TabsTrigger>
              <TabsTrigger value="manual">手动筛选</TabsTrigger>
            </TabsList>

            <TabsContent value="auto" className="space-y-5">
              <BackgroundSummaryCard />
              <div className="rounded-2xl border border-[#E8ECE9] bg-[#F7FAF8] p-5">
                <p className="text-sm font-medium text-[#173D31]">
                  系统会自动推断以下条件
                </p>
                <p className="mt-2 text-sm leading-7 text-[#314740]">
                  会优先参考你已保存的求职偏好；没有偏好时，会回退到当前用户画像、工作年限、技能、目标公司和最近一次简历解析结果。
                </p>
                {latestAutoResult ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-2xl border border-[#E8ECE9] bg-white p-4">
                      <p className="text-xs text-[#6B7B74]">最近一次岗位</p>
                      <p className="mt-2 text-sm font-medium text-[#141414]">
                        {latestAutoResult.inferredQuery.role || "未限定"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#E8ECE9] bg-white p-4">
                      <p className="text-xs text-[#6B7B74]">最近一次城市</p>
                      <p className="mt-2 text-sm font-medium text-[#141414]">
                        {latestAutoResult.inferredQuery.cities.join("、") ||
                          "不限"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#E8ECE9] bg-white p-4">
                      <p className="text-xs text-[#6B7B74]">最近一次薪资</p>
                      <p className="mt-2 text-sm font-medium text-[#141414]">
                        {latestAutoResult.inferredQuery.salaryRange
                          ? `${latestAutoResult.inferredQuery.salaryRange.minK ?? "?"}-${latestAutoResult.inferredQuery.salaryRange.maxK ?? "?"}K`
                          : "不限"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#E8ECE9] bg-white p-4">
                      <p className="text-xs text-[#6B7B74]">最近一次行业</p>
                      <p className="mt-2 text-sm font-medium text-[#141414]">
                        {latestAutoResult.inferredQuery.industries.join("、") ||
                          "不限"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#E8ECE9] bg-white p-4">
                      <p className="text-xs text-[#6B7B74]">最近一次公司大小</p>
                      <p className="mt-2 text-sm font-medium text-[#141414]">
                        {latestAutoResult.inferredQuery.companySizes.join(
                          "、",
                        ) || "不限"}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => void handleCreateAutoJob()}
                  disabled={!canStartRecommendations || isSubmittingAuto}
                >
                  {isSubmittingAuto ? "创建中..." : "开始自动推荐"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#141414]">城市</p>
                  <Input
                    value={manualForm.city}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        city: event.target.value,
                      }))
                    }
                    placeholder="例如：上海"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#141414]">岗位</p>
                  <Input
                    value={manualForm.role}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        role: event.target.value,
                      }))
                    }
                    placeholder="例如：前端工程师"
                  />
                  {manualErrors.role ? (
                    <p className="text-sm text-[#A14D2A]">
                      {manualErrors.role}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#141414]">
                    期望薪资最低值（K）
                  </p>
                  <Input
                    value={manualForm.salaryMinK}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        salaryMinK: event.target.value,
                      }))
                    }
                    placeholder="例如：25"
                  />
                  {manualErrors.salaryMinK ? (
                    <p className="text-sm text-[#A14D2A]">
                      {manualErrors.salaryMinK}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#141414]">
                    期望薪资最高值（K）
                  </p>
                  <Input
                    value={manualForm.salaryMaxK}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        salaryMaxK: event.target.value,
                      }))
                    }
                    placeholder="例如：35"
                  />
                  {manualErrors.salaryMaxK ? (
                    <p className="text-sm text-[#A14D2A]">
                      {manualErrors.salaryMaxK}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#141414]">行业</p>
                  <Input
                    value={manualForm.industry}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        industry: event.target.value,
                      }))
                    }
                    placeholder="例如：AI 应用"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#141414]">公司大小</p>
                  <Input
                    value={manualForm.companySize}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        companySize: event.target.value,
                      }))
                    }
                    placeholder="例如：100-499人"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] px-4 py-3">
                <Checkbox
                  checked={manualForm.savePreferences}
                  onCheckedChange={(checked) =>
                    setManualForm((current) => ({
                      ...current,
                      savePreferences: checked === true,
                    }))
                  }
                />
                <span className="text-sm text-[#314740]">
                  将本次手动筛选保存为默认求职偏好
                </span>
              </label>

              <div className="flex justify-end">
                <Button
                  onClick={() => void handleCreateManualJob()}
                  disabled={!canStartRecommendations || isSubmittingManual}
                >
                  {isSubmittingManual ? "创建中..." : "开始手动推荐"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {jobError ? (
        <Card className="border-[#F0E5D9] bg-[#FFF9F3]">
          <CardContent className="pt-6 text-sm text-[#8B5A24]">
            {jobError}
          </CardContent>
        </Card>
      ) : null}

      {pendingJobs.length > 0 ? (
        <Card className="border-[#E8ECE9] bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#141414]">
              处理中
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] p-4 text-sm text-[#314740]"
              >
                {job.payload.mode === "auto" ? "自动推荐" : "手动推荐"}任务正在
                {job.status === "running" ? "执行" : "排队"}
                中，提交时间：{formatDateTime(job.createdAt)}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {latestSucceededJob?.result ? (
        <Card className="border-[#E8ECE9] bg-white">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-xl font-semibold text-[#141414]">
                  最新推荐结果
                </CardTitle>
                <CardDescription>
                  {latestSucceededJob.result.summary}
                </CardDescription>
              </div>
              <Link
                href={`/job-recommendations/${latestSucceededJob.id}`}
                className="text-sm font-medium text-[#1E5D47] underline underline-offset-4"
              >
                查看完整详情
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestSucceededJob.result.jobs.map((job) => (
              <RecommendationJobCard
                key={job.sourceJobId}
                job={job}
                onFeedback={handleFeedback}
                pendingAction={feedbackState[job.sourceJobId]}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-[#E8ECE9] bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#141414]">
            历史记录
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.length === 0 ? (
            <p className="text-sm text-[#5F6B66]">
              还没有岗位推荐记录，先连接 BOSS 账号，再开始第一次推荐。
            </p>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col gap-3 rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-[#141414]">
                    {job.payload.mode === "auto" ? "自动推荐" : "手动推荐"}
                  </p>
                  <p className="text-sm text-[#5F6B66]">
                    {formatDateTime(job.createdAt)}
                  </p>
                  {job.errorMessage ? (
                    <p className="text-sm text-[#A14D2A]">{job.errorMessage}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    className={
                      job.status === "succeeded"
                        ? "bg-[#173D31] text-white"
                        : job.status === "failed"
                          ? "bg-[#A14D2A] text-white"
                          : "bg-[#C38B2E] text-white"
                    }
                  >
                    {job.status === "succeeded"
                      ? "已完成"
                      : job.status === "failed"
                        ? "失败"
                        : job.status === "running"
                          ? "执行中"
                          : "排队中"}
                  </Badge>
                  {job.status === "succeeded" ? (
                    <Link
                      href={`/job-recommendations/${job.id}`}
                      className="text-sm font-medium text-[#1E5D47] underline underline-offset-4"
                    >
                      查看详情
                    </Link>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

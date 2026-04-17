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

  async function handleSaveSession() {
    if (!sessionCookie.trim()) {
      setSessionError("请粘贴完整 Cookie");
      return;
    }

    setIsSavingSession(true);
    setSessionError("");
    try {
      const saved = await saveBossSession(sessionCookie.trim());
      setSession(saved);
      setSessionCookie("");
    } catch (error) {
      setSessionError(
        error instanceof Error ? error.message : "BOSS 登录态保存失败",
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
            BOSS 登录态
          </CardTitle>
          <CardDescription>
            首版需要你导入自己的 BOSS
            Cookie。服务端只保存受限会话，不回显原始值。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {session ? (
            <div className="rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] p-4">
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
                      当前可以直接发起岗位推荐任务。
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => void handleDeleteSession()}
                  disabled={isSavingSession}
                >
                  删除会话
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <Textarea
              value={sessionCookie}
              onChange={(event) => setSessionCookie(event.target.value)}
              placeholder="粘贴从浏览器复制的完整 Cookie"
              className="min-h-28"
            />
            {sessionError ? (
              <p className="text-sm text-[#A14D2A]">{sessionError}</p>
            ) : null}
            <div className="flex justify-end">
              <Button
                onClick={() => void handleSaveSession()}
                disabled={isSavingSession}
              >
                {isSavingSession
                  ? "校验中..."
                  : session
                    ? "重新导入 Cookie"
                    : "导入 Cookie"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#E8ECE9] bg-white">
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
                  disabled={!session || isSubmittingAuto}
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
                  disabled={!session || isSubmittingManual}
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
              还没有岗位推荐记录，先导入 BOSS Cookie 后开始一次推荐。
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

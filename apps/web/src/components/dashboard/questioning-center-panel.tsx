"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { QuestioningJob } from "@interviewclaw/domain";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import type { UserAccessState } from "@/types/billing";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getResumeLibrary,
  type ResumeLibraryItem,
} from "@/action/get-resume-library";
import {
  createQuestioningJob,
  getQuestioningJob,
  listQuestioningJobs,
} from "@/lib/llm-jobs-client";
import {
  validateQuestioningForm,
  type QuestioningFormErrors,
  type QuestioningFormValues,
  type QuestioningTrack,
} from "@/lib/questioning-center";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

const SOCIAL_EXPERIENCE_OPTIONS = [
  { value: "0-1", label: "0-1 年" },
  { value: "1-3", label: "1-3 年" },
  { value: "3-5", label: "3-5 年" },
  { value: "5-8", label: "5-8 年" },
  { value: "8+", label: "8 年以上" },
] as const;

const QUESTIONING_POLL_INTERVAL_MS = 6000;

interface BillingAccessResponse {
  access: UserAccessState;
}

function isPendingQuestioningJob(job: QuestioningJob) {
  return job.status === "queued" || job.status === "running";
}

function mergeQuestioningJobs(
  currentJobs: QuestioningJob[],
  nextJobs: QuestioningJob[],
) {
  if (nextJobs.length === 0) {
    return currentJobs;
  }

  const nextJobMap = new Map(nextJobs.map((job) => [job.id, job]));
  const merged = currentJobs.map((job) => nextJobMap.get(job.id) ?? job);
  const existingIds = new Set(currentJobs.map((job) => job.id));

  for (const job of nextJobs) {
    if (!existingIds.has(job.id)) {
      merged.push(job);
    }
  }

  return merged;
}

export function QuestioningCenterPanel() {
  const t = useTranslations("dashboard.questioning");
  const [resumeLibrary, setResumeLibrary] = useState<ResumeLibraryItem[]>([]);
  const [jobs, setJobs] = useState<QuestioningJob[]>([]);
  const [access, setAccess] = useState<UserAccessState | null>(null);
  const [jobError, setJobError] = useState("");
  const [jobWarning, setJobWarning] = useState("");
  const hasResumeLibrary = resumeLibrary.length > 0;
  const historyReports = jobs
    .filter((job) => job.status === "succeeded" && job.result)
    .map((job) => job.result!);
  const hasHistoryReports = historyReports.length > 0;

  const [formValues, setFormValues] = useState<QuestioningFormValues>({
    resumeId: "",
    targetRole: "",
    track: "social",
    workExperience: "",
    targetCompany: "",
    jobDescription: "",
  });
  const [errors, setErrors] = useState<QuestioningFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAccessLoading, setIsAccessLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const pendingJobs = useMemo(
    () => jobs.filter(isPendingQuestioningJob),
    [jobs],
  );
  const activePendingJob = pendingJobs[0] ?? null;
  const hasPendingJob = !!activePendingJob;
  const isTrialExhausted =
    access?.tier !== "premium" &&
    typeof access?.trialRemaining === "number" &&
    access.trialRemaining <= 0;
  const isGenerateDisabled =
    isSubmitting || isAccessLoading || !hasResumeLibrary || isTrialExhausted;

  const loadAccess = useCallback(async () => {
    setIsAccessLoading(true);
    try {
      const response = await fetch("/api/billing/access", {
        cache: "no-store",
      });
      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as BillingAccessResponse;
      setAccess(payload.access);
      return payload.access;
    } catch (error) {
      console.error("[questioning-center] failed to load access:", error);
      return null;
    } finally {
      setIsAccessLoading(false);
    }
  }, []);

  const applyQuestioningJobList = useCallback(
    (result: Awaited<ReturnType<typeof listQuestioningJobs>>) => {
      setJobWarning(result.warning || "");
      setJobs((prev) => {
        if (result.warning && result.jobs.length === 0 && prev.length > 0) {
          return prev;
        }
        return result.jobs;
      });
    },
    [],
  );

  useEffect(() => {
    void Promise.all([getResumeLibrary(), listQuestioningJobs()])
      .then(([resumes, questioningResult]) => {
        setResumeLibrary(resumes);
        applyQuestioningJobList(questioningResult);
        console.info("[questioning-center] initial data loaded", {
          resumeCount: resumes.length,
          jobCount: questioningResult.jobs.length,
          hasWarning: !!questioningResult.warning,
        });
      })
      .catch((error) => {
        console.error("Failed to load questioning center data:", error);
      });
    void loadAccess();
  }, [applyQuestioningJobList, loadAccess]);

  useEffect(() => {
    if (pendingJobs.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void Promise.all(
        pendingJobs.map(async (job) => {
          try {
            const refreshedJob = await getQuestioningJob(job.id);
            const waitSeconds = Math.round(
              (Date.now() -
                new Date(job.startedAt || job.createdAt).getTime()) /
                1000,
            );
            console.info("[questioning-center] poll result", {
              jobId: job.id,
              status: refreshedJob.status,
              waitSeconds,
              attemptCount: refreshedJob.attemptCount,
              startedAt: refreshedJob.startedAt,
              completedAt: refreshedJob.completedAt,
            });
            return refreshedJob;
          } catch (error) {
            console.error("Failed to poll questioning job:", error);
            return null;
          }
        }),
      ).then((results) => {
        const refreshedJobs = results.filter(Boolean) as QuestioningJob[];
        if (refreshedJobs.length === 0) {
          return;
        }

        setPollCount((prev) => prev + 1);
        setJobs((prev) => mergeQuestioningJobs(prev, refreshedJobs));

        const latestSucceededJob = refreshedJobs.find(
          (job) => job.status === "succeeded",
        );
        if (latestSucceededJob) {
          setLastGeneratedAt(
            latestSucceededJob.completedAt || latestSucceededJob.updatedAt,
          );
          setJobError("");
          setJobWarning("");
          void loadAccess();
        }

        const latestFailedJob = refreshedJobs.find(
          (job) => job.status === "failed",
        );
        if (latestFailedJob) {
          setJobError(
            latestFailedJob.errorMessage || "押题任务生成失败，请稍后重试",
          );
        }
      });
    }, QUESTIONING_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadAccess, pendingJobs]);

  const generationSummary = useMemo(() => {
    if (!lastGeneratedAt) return null;

    return {
      title: t("result.title"),
      description: t("result.description", {
        role: formValues.targetRole,
        track:
          formValues.track === "social"
            ? t("tracks.social")
            : t("tracks.campus"),
        generatedAt: lastGeneratedAt,
      }),
    };
  }, [formValues.targetRole, formValues.track, lastGeneratedAt, t]);

  const updateField = <K extends keyof QuestioningFormValues>(
    key: K,
    value: QuestioningFormValues[K],
  ) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as keyof QuestioningFormErrors]) {
        return prev;
      }

      const next = { ...prev };
      delete next[key as keyof QuestioningFormErrors];
      return next;
    });
  };

  const handleTrackChange = (nextTrack: QuestioningTrack) => {
    setFormValues((prev) => ({
      ...prev,
      track: nextTrack,
      workExperience: nextTrack === "social" ? prev.workExperience : "",
    }));

    setErrors((prev) => {
      if (!prev.workExperience) {
        return prev;
      }

      const next = { ...prev };
      delete next.workExperience;
      return next;
    });
  };

  const submitQuestioningJob = async () => {
    if (isTrialExhausted) {
      setConfirmOpen(false);
      setJobError("押题次数已用完，请升级会员后继续");
      return;
    }

    setIsSubmitting(true);
    setConfirmOpen(false);
    setJobError("");
    setJobWarning("");
    setPollCount(0);
    console.info("[questioning-center] create job start", {
      resumeId: formValues.resumeId,
      targetRole: formValues.targetRole,
      track: formValues.track,
      hasTargetCompany: !!formValues.targetCompany,
      hasJobDescription: !!formValues.jobDescription.trim(),
    });

    try {
      const job = await createQuestioningJob({
        resumeId: formValues.resumeId,
        targetRole: formValues.targetRole,
        track: formValues.track,
        ...(formValues.workExperience
          ? { workExperience: formValues.workExperience }
          : {}),
        ...(formValues.targetCompany
          ? { targetCompany: formValues.targetCompany }
          : {}),
        ...(formValues.jobDescription
          ? { jobDescription: formValues.jobDescription }
          : {}),
      });
      console.info("[questioning-center] create job success", {
        jobId: job.id,
        status: job.status,
        createdAt: job.createdAt,
      });
      setJobs((prev) => [job, ...prev]);
      void loadAccess();
    } catch (error) {
      console.error("Failed to create questioning job:", error);
      setJobError(error instanceof Error ? error.message : "押题任务创建失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerate = async () => {
    const formErrors = validateQuestioningForm(formValues);
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    const currentAccess = access ?? (await loadAccess());
    const isCurrentTrialExhausted =
      currentAccess?.tier !== "premium" &&
      typeof currentAccess?.trialRemaining === "number" &&
      currentAccess.trialRemaining <= 0;

    if (isCurrentTrialExhausted) {
      setJobError("押题次数已用完，请升级会员后继续");
      return;
    }

    if (currentAccess?.tier === "premium") {
      await submitQuestioningJob();
      return;
    }

    setConfirmOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card className="border-[#E5E5E5] bg-white">
        <CardHeader>
          <CardTitle className="text-xl text-[#141414]">
            {t("form.title")}
          </CardTitle>
          <CardDescription>{t("form.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#141414]">
                {t("form.resumeLabel")}
              </label>
              <Select
                value={formValues.resumeId}
                onValueChange={(value) => updateField("resumeId", value)}
                disabled={!hasResumeLibrary}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("form.resumePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {resumeLibrary.map((resume) => (
                    <SelectItem key={resume.id} value={resume.filePath}>
                      {resume.defaultName} · {resume.uploadedAt.slice(0, 10)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!hasResumeLibrary && (
                <p className="text-sm text-muted-foreground">
                  {t("empty.resumeLibrary")}
                </p>
              )}
              {errors.resumeId && (
                <p className="text-sm text-red-500">{errors.resumeId}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#141414]">
                {t("form.targetRoleLabel")}
              </label>
              <Input
                value={formValues.targetRole}
                onChange={(event) =>
                  updateField("targetRole", event.currentTarget.value)
                }
                placeholder={t("form.targetRolePlaceholder")}
              />
              {errors.targetRole && (
                <p className="text-sm text-red-500">{errors.targetRole}</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-[#141414]">
              {t("form.trackLabel")}
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              {(["social", "campus"] as const).map((track) => {
                const selected = formValues.track === track;
                return (
                  <button
                    key={track}
                    type="button"
                    onClick={() => handleTrackChange(track)}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-[#E5E5E5] bg-white hover:bg-[#FAFAFA]",
                    )}
                  >
                    <p className="font-medium text-[#141414]">
                      {t(`tracks.${track}`)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {track === "social"
                        ? t("tracks.socialDesc")
                        : t("tracks.campusDesc")}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {formValues.track === "social" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#141414]">
                {t("form.workExperienceLabel")}
              </label>
              <Select
                value={formValues.workExperience}
                onValueChange={(value) => updateField("workExperience", value)}
              >
                <SelectTrigger className="w-full md:max-w-sm">
                  <SelectValue
                    placeholder={t("form.workExperiencePlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_EXPERIENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.workExperience && (
                <p className="text-sm text-red-500">{errors.workExperience}</p>
              )}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#141414]">
                {t("form.targetCompanyLabel")}
              </label>
              <Input
                value={formValues.targetCompany}
                onChange={(event) =>
                  updateField("targetCompany", event.currentTarget.value)
                }
                placeholder={t("form.targetCompanyPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#141414]">
                {t("form.jdLabel")}
              </label>
              <Textarea
                value={formValues.jobDescription}
                onChange={(event) =>
                  updateField("jobDescription", event.currentTarget.value)
                }
                placeholder={t("form.jdPlaceholder")}
                className="min-h-[120px]"
              />
            </div>
          </div>

          <Button
            onClick={() => void handleGenerate()}
            loading={isSubmitting}
            disabled={isGenerateDisabled}
            className="h-11 w-full cursor-pointer md:w-auto"
          >
            {isTrialExhausted
              ? "押题次数已用完"
              : isSubmitting
                ? t("form.generating")
                : t("form.generate")}
          </Button>

          {!access || access.tier !== "premium" ? (
            isTrialExhausted ? (
              <p className="text-sm text-amber-600">
                押题次数已用完，请前往
                <Link
                  href="/dashboard/profile"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  会员中心
                </Link>
                充值后继续。
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {typeof access?.trialRemaining === "number"
                  ? `当前剩余押题次数 ${access.trialRemaining} 次，确认生成后将扣除 1 次。`
                  : "确认生成后将扣除 1 次押题次数。"}
              </p>
            )
          ) : null}

          {hasPendingJob && (
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm text-primary">
                <Sparkles className="h-4 w-4 animate-pulse" />
                {activePendingJob.status === "running"
                  ? "当前有任务正在生成中，您仍可继续提交新的押题任务。"
                  : activePendingJob.attemptCount > 0
                    ? "上一个任务生成失败，正在等待系统自动重试，您仍可继续提交新的押题任务。"
                    : "任务已提交，正在排队处理中，您仍可继续提交新的押题任务。"}
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-primary/10">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
              </div>
            </div>
          )}

          {jobError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {jobError}
            </div>
          ) : null}

          {jobWarning ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {jobWarning}
            </div>
          ) : null}

          {generationSummary && (
            <div className="rounded-lg border border-[#E5E5E5] bg-[#F9FBFA] p-4">
              <p className="font-medium text-[#141414]">
                {generationSummary.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {generationSummary.description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认生成押题报告？</AlertDialogTitle>
            <AlertDialogDescription>
              {access?.tier === "premium"
                ? "会员用户生成押题报告不扣次数，确认后将开始创建任务。"
                : isTrialExhausted
                  ? "押题次数已用完，请前往会员中心充值后继续。"
                  : `本次将扣除 1 次押题次数${typeof access?.trialRemaining === "number" ? `，当前剩余 ${access.trialRemaining} 次` : ""}。确认后将开始创建任务。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="cursor-pointer"
              disabled={isSubmitting}
            >
              取消
            </AlertDialogCancel>
            <Button
              onClick={() => void submitQuestioningJob()}
              loading={isSubmitting}
              disabled={isTrialExhausted}
              className="cursor-pointer"
            >
              确认并生成
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="border-[#E5E5E5] bg-white">
        <CardHeader>
          <CardTitle className="text-xl text-[#141414]">
            {t("history.title")}
          </CardTitle>
          <CardDescription>{t("history.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasHistoryReports ? (
            historyReports.map((report) => (
              <details
                key={report.id}
                className="group rounded-lg border border-[#E5E5E5] bg-white p-4"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#141414]">
                        {report.title}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateTime(report.createdAt)}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {report.track === "social"
                        ? t("tracks.social")
                        : t("tracks.campus")}
                    </Badge>
                  </div>
                </summary>
                <div className="mt-4 space-y-3 border-t border-[#F0F0F0] pt-3">
                  <p className="text-sm text-muted-foreground">
                    {report.summary}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {report.highlights.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <Button asChild variant="outline" className="cursor-pointer">
                    <Link href={`/questioning/${report.id}`}>
                      {t("history.viewDetail")}
                    </Link>
                  </Button>
                </div>
              </details>
            ))
          ) : (
            <div
              className="rounded-lg border border-dashed border-[#DADADA] bg-[#FCFCFC] px-6 py-10 text-center"
              role="status"
              aria-live="polite"
            >
              <p className="text-base font-medium text-[#141414]">
                {t("history.emptyTitle")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("history.emptyDescription")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

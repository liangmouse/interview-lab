"use client";

import { useEffect, useMemo, useState } from "react";
import type { QuestioningJob } from "@interviewclaw/domain";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles } from "lucide-react";
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

const SOCIAL_EXPERIENCE_OPTIONS = [
  { value: "0-1", label: "0-1 年" },
  { value: "1-3", label: "1-3 年" },
  { value: "3-5", label: "3-5 年" },
  { value: "5-8", label: "5-8 年" },
  { value: "8+", label: "8 年以上" },
] as const;

export function QuestioningCenterPanel() {
  const t = useTranslations("dashboard.questioning");
  const [resumeLibrary, setResumeLibrary] = useState<ResumeLibraryItem[]>([]);
  const [jobs, setJobs] = useState<QuestioningJob[]>([]);
  const [activeJob, setActiveJob] = useState<QuestioningJob | null>(null);
  const [jobError, setJobError] = useState("");
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const [jobStartedAt, setJobStartedAt] = useState<number | null>(null);

  useEffect(() => {
    void Promise.all([getResumeLibrary(), listQuestioningJobs()])
      .then(([resumes, questioningJobs]) => {
        setResumeLibrary(resumes);
        setJobs(questioningJobs);
        console.info("[questioning-center] initial data loaded", {
          resumeCount: resumes.length,
          jobCount: questioningJobs.length,
        });
      })
      .catch((error) => {
        console.error("Failed to load questioning center data:", error);
      });
  }, []);

  useEffect(() => {
    if (
      !activeJob ||
      activeJob.status === "succeeded" ||
      activeJob.status === "failed"
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      void getQuestioningJob(activeJob.id)
        .then((job) => {
          const waitSeconds = jobStartedAt
            ? Math.round((Date.now() - jobStartedAt) / 1000)
            : null;
          setPollCount((prev) => {
            const next = prev + 1;
            console.info("[questioning-center] poll result", {
              jobId: activeJob.id,
              pollCount: next,
              status: job.status,
              waitSeconds,
              attemptCount: job.attemptCount,
              startedAt: job.startedAt,
              completedAt: job.completedAt,
            });
            return next;
          });
          setActiveJob(job);
          if (job.status === "succeeded") {
            setIsGenerating(false);
            setLastGeneratedAt(job.completedAt || job.updatedAt);
            setJobError("");
            return listQuestioningJobs().then(setJobs);
          }
          if (job.status === "failed") {
            setIsGenerating(false);
            setJobError(job.errorMessage || "押题任务生成失败，请稍后重试");
          }
          return undefined;
        })
        .catch((error) => {
          console.error("Failed to poll questioning job:", error);
        });
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeJob, jobStartedAt]);

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

  const handleGenerate = async () => {
    const formErrors = validateQuestioningForm(formValues);
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    setIsGenerating(true);
    setJobError("");
    setPollCount(0);
    setJobStartedAt(Date.now());
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
      setActiveJob(job);
      setJobs((prev) => [job, ...prev]);
    } catch (error) {
      console.error("Failed to create questioning job:", error);
      setIsGenerating(false);
      setJobStartedAt(null);
      setJobError(error instanceof Error ? error.message : "押题任务创建失败");
    }
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
            onClick={handleGenerate}
            disabled={isGenerating || !hasResumeLibrary}
            className="h-11 w-full cursor-pointer md:w-auto"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("form.generating")}
              </>
            ) : (
              t("form.generate")
            )}
          </Button>

          {isGenerating && (
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm text-primary">
                <Sparkles className="h-4 w-4 animate-pulse" />
                {activeJob?.status === "running"
                  ? "正在结合简历与题库生成押题报告..."
                  : "任务已提交，正在加紧处理，您可以稍后回来查看结果..."}
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
                        {report.createdAt}
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

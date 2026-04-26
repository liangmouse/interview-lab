"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ResumeReviewJob } from "@interviewclaw/domain";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Building2,
  FileText,
  FolderOpenDot,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getResumeLibrary,
  type ResumeLibraryItem,
} from "@/action/get-resume-library";
import { formatDateTime } from "@/lib/format";
import {
  createResumeReviewJob,
  getResumeReviewJob,
  listResumeReviewJobs,
} from "@/lib/llm-jobs-client";
import { ResumeReviewResults } from "./resume-review-results";

const REVIEW_HISTORY_REFRESH_INTERVAL_MS = 15000;

function upsertJobList(jobs: ResumeReviewJob[], job: ResumeReviewJob) {
  const next = [job, ...jobs.filter((item) => item.id !== job.id)];
  return next.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

function resolveJobStatus(job: ResumeReviewJob) {
  if (job.status === "succeeded" && job.result) {
    return {
      label: "已完成",
      value: `${job.result.overallScore} 分`,
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (job.status === "failed") {
    return {
      label: "生成失败",
      value: "待重试",
      badgeClass: "border-red-200 bg-red-50 text-red-600",
    };
  }

  return {
    label: job.status === "running" ? "生成中" : "排队中",
    value: "--",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

export function ResumeReviewPanel({
  initialReviewJobs = [],
}: {
  initialReviewJobs?: ResumeReviewJob[];
}) {
  const t = useTranslations("dashboard.resumeReview");

  const [resumes, setResumes] = useState<ResumeLibraryItem[]>([]);
  const [reviewJobs, setReviewJobs] =
    useState<ResumeReviewJob[]>(initialReviewJobs);
  const [selectedResumePath, setSelectedResumePath] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [targetCompany, setTargetCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [activeJob, setActiveJob] = useState<ResumeReviewJob | null>(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [jobError, setJobError] = useState("");

  const loadReviewJobs = useCallback(async () => {
    const jobs = await listResumeReviewJobs();
    setReviewJobs(jobs);
    return jobs;
  }, []);

  useEffect(() => {
    void getResumeLibrary().then(setResumes);
    void loadReviewJobs().catch((error) => {
      console.error("Failed to load resume review jobs:", error);
    });
  }, [loadReviewJobs]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadReviewJobs().catch((error) => {
        console.error("Failed to refresh resume review jobs:", error);
      });
    }, REVIEW_HISTORY_REFRESH_INTERVAL_MS);

    const handleFocus = () => {
      void loadReviewJobs().catch((error) => {
        console.error("Failed to refresh resume review jobs on focus:", error);
      });
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadReviewJobs]);

  useEffect(() => {
    if (
      !activeJob ||
      activeJob.status === "succeeded" ||
      activeJob.status === "failed"
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      void getResumeReviewJob(activeJob.id)
        .then((job) => {
          setActiveJob(job);
          setReviewJobs((prev) => upsertJobList(prev, job));

          if (job.status === "succeeded" && job.result) {
            setIsReviewing(false);
            setJobError("");
            setSelectedReviewId(job.id);
          }

          if (job.status === "failed") {
            setIsReviewing(false);
            setJobError(job.errorMessage || "简历点评生成失败，请稍后重试");
          }
        })
        .catch((error) => {
          console.error("Failed to poll resume review job:", error);
        });
    }, 3000);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeJob]);

  const hasResumes = resumes.length > 0;

  const resumeMetaByPath = useMemo(() => {
    return new Map(resumes.map((resume) => [resume.filePath, resume]));
  }, [resumes]);

  const selectedReviewJob = useMemo(() => {
    if (!selectedReviewId) {
      return null;
    }
    return (
      reviewJobs.find(
        (job) => job.id === selectedReviewId && job.status === "succeeded",
      ) ?? null
    );
  }, [reviewJobs, selectedReviewId]);

  const handleStartReview = async () => {
    if (!selectedResumePath) return;

    const normalizedTargetRole = targetRole.trim();
    const normalizedTargetCompany = targetCompany.trim();
    const normalizedJobDescription = jobDescription.trim();

    if (!normalizedTargetRole) {
      setJobError("请填写目标岗位");
      return;
    }

    if (!normalizedTargetCompany) {
      setJobError("请填写目标公司");
      return;
    }

    setIsReviewing(true);
    setSelectedReviewId(null);
    setJobError("");

    try {
      const job = await createResumeReviewJob({
        resumeStoragePath: selectedResumePath,
        targetRole: normalizedTargetRole,
        targetCompany: normalizedTargetCompany,
        ...(normalizedJobDescription
          ? { jobDescription: normalizedJobDescription }
          : {}),
      });
      setActiveJob(job);
      setReviewJobs((prev) => upsertJobList(prev, job));
    } catch (error) {
      console.error("Failed to create resume review job:", error);
      setIsReviewing(false);
      setJobError(
        error instanceof Error ? error.message : "简历点评任务创建失败",
      );
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
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#141414]">
              {t("form.resumeLabel")}
            </label>
            <Select
              value={selectedResumePath}
              onValueChange={setSelectedResumePath}
              disabled={!hasResumes}
            >
              <SelectTrigger className="w-full md:max-w-sm">
                <SelectValue placeholder={t("form.resumePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {resumes.map((resume) => (
                  <SelectItem key={resume.id} value={resume.filePath}>
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {resume.defaultName}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!hasResumes && (
              <p className="text-sm text-muted-foreground">
                {t("form.noResumes")}{" "}
                <Link href="/profile" className="underline underline-offset-2">
                  {t("form.goToProfile")}
                </Link>
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#141414]">
                {t("form.targetRoleLabel")}
              </label>
              <div className="relative">
                <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={targetRole}
                  onChange={(event) => setTargetRole(event.currentTarget.value)}
                  placeholder={t("form.targetRolePlaceholder")}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#141414]">
                {t("form.targetCompanyLabel")}
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={targetCompany}
                  onChange={(event) =>
                    setTargetCompany(event.currentTarget.value)
                  }
                  placeholder={t("form.targetCompanyPlaceholder")}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[#141414]">
              {t("form.jdLabel")}
            </label>
            <Textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.currentTarget.value)}
              placeholder={t("form.jdPlaceholder")}
              className="min-h-[120px]"
            />
          </div>

          <Button
            onClick={handleStartReview}
            disabled={isReviewing || !hasResumes || !selectedResumePath}
            className="h-11 w-full cursor-pointer bg-[#0F3E2E] hover:bg-[#0a2e21] md:w-auto"
          >
            {isReviewing ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" />
                {t("form.reviewing")}
              </>
            ) : (
              t("form.startReview")
            )}
          </Button>

          {isReviewing && (
            <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm text-primary">
                <Sparkles className="h-4 w-4 animate-pulse" />
                {activeJob?.status === "running"
                  ? t("form.runningHint")
                  : t("form.queueHint")}
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
        </CardContent>
      </Card>

      <Card className="border-[#E5E5E5] bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-[#141414]">
            {t("history.title")}
          </CardTitle>
          <CardDescription>{t("history.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {reviewJobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E5E5E5] bg-[#FAFAFA] px-5 py-8 text-center text-sm text-muted-foreground">
              <FolderOpenDot className="mx-auto mb-3 h-5 w-5 text-[#94A3B8]" />
              {t("history.empty")}
            </div>
          ) : (
            reviewJobs.map((job) => {
              const resumeMeta = resumeMetaByPath.get(
                job.payload.resumeStoragePath,
              );
              const statusMeta = resolveJobStatus(job);
              const isSelected = selectedReviewId === job.id;

              return (
                <div
                  key={job.id}
                  className="rounded-xl border border-[#EAEAEA] px-4 py-4 transition-colors hover:border-[#D6D6D6]"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-[#141414]">
                          {job.result?.resumeName ||
                            resumeMeta?.defaultName ||
                            t("history.unknownResume")}
                        </p>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusMeta.badgeClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {t("history.uploadedAt")}：
                          {resumeMeta
                            ? formatDateTime(resumeMeta.uploadedAt)
                            : t("history.unknownTime")}
                        </span>
                        <span>
                          {t("history.score")}：{statusMeta.value}
                        </span>
                        <span>
                          {t("history.reviewedAt")}：
                          {job.completedAt
                            ? formatDateTime(job.completedAt)
                            : t("history.pendingTime")}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant={isSelected ? "default" : "outline"}
                      className={
                        isSelected
                          ? "bg-[#0F3E2E] hover:bg-[#0a2e21]"
                          : "border-[#DADADA]"
                      }
                      disabled={job.status !== "succeeded" || !job.result}
                      onClick={() =>
                        setSelectedReviewId((current) =>
                          current === job.id ? null : job.id,
                        )
                      }
                    >
                      {isSelected
                        ? t("history.hideDetail")
                        : t("history.viewDetail")}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {selectedReviewJob?.result ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-[#141414]">
              {t("detail.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {selectedReviewJob.result.resumeName} ·{" "}
              {formatDateTime(
                selectedReviewJob.completedAt || selectedReviewJob.createdAt,
              )}
            </p>
          </div>
          <ResumeReviewResults result={selectedReviewJob.result} />
        </div>
      ) : null}
    </div>
  );
}

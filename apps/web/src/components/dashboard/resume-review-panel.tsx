"use client";

import { useEffect, useState } from "react";
import type { ResumeReviewJob } from "@interviewclaw/domain";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  createResumeReviewJob,
  getResumeReviewJob,
  listResumeReviewJobs,
} from "@/lib/llm-jobs-client";
import { ResumeReviewResults } from "./resume-review-results";
import type { ResumeReviewResult } from "@/types/resume-review";

export function ResumeReviewPanel() {
  const t = useTranslations("dashboard.resumeReview");

  const [resumes, setResumes] = useState<ResumeLibraryItem[]>([]);
  const [selectedResumePath, setSelectedResumePath] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [activeJob, setActiveJob] = useState<ResumeReviewJob | null>(null);
  const [jobError, setJobError] = useState("");
  const [reviewResult, setReviewResult] = useState<ResumeReviewResult | null>(
    null,
  );
  const [pollCount, setPollCount] = useState(0);
  const [jobStartedAt, setJobStartedAt] = useState<number | null>(null);

  useEffect(() => {
    void getResumeLibrary().then(setResumes);
    void listResumeReviewJobs()
      .then((jobs) => {
        console.info("[resume-review] initial jobs loaded", {
          jobCount: jobs.length,
        });
        const latestSucceeded = jobs.find((job) => job.status === "succeeded");
        if (latestSucceeded?.result) {
          setReviewResult(latestSucceeded.result);
        }
      })
      .catch((error) => {
        console.error("Failed to load resume review jobs:", error);
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
      void getResumeReviewJob(activeJob.id)
        .then((job) => {
          const waitSeconds = jobStartedAt
            ? Math.round((Date.now() - jobStartedAt) / 1000)
            : null;
          setPollCount((prev) => {
            const next = prev + 1;
            console.info("[resume-review] poll result", {
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
          if (job.status === "succeeded" && job.result) {
            setReviewResult(job.result);
            setIsReviewing(false);
            setJobError("");
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
  }, [activeJob, jobStartedAt]);

  const hasResumes = resumes.length > 0;

  const handleStartReview = async () => {
    if (!selectedResumePath) return;

    setIsReviewing(true);
    setReviewResult(null);
    setJobError("");
    setPollCount(0);
    setJobStartedAt(Date.now());
    console.info("[resume-review] create job start", {
      resumeStoragePath: selectedResumePath,
      hasJobDescription: !!jobDescription.trim(),
    });

    try {
      const job = await createResumeReviewJob({
        resumeStoragePath: selectedResumePath,
        ...(jobDescription.trim()
          ? { jobDescription: jobDescription.trim() }
          : {}),
      });
      console.info("[resume-review] create job success", {
        jobId: job.id,
        status: job.status,
        createdAt: job.createdAt,
      });
      setActiveJob(job);
    } catch (error) {
      console.error("Failed to create resume review job:", error);
      setIsReviewing(false);
      setJobStartedAt(null);
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
                  ? "正在分析简历并生成点评，请稍候..."
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
        </CardContent>
      </Card>

      {reviewResult && <ResumeReviewResults result={reviewResult} />}
    </div>
  );
}

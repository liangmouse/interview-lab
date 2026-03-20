"use client";

import { useEffect, useState } from "react";
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
import { mockResumeReviewResult } from "@/lib/resume-review-mock";
import { ResumeReviewResults } from "./resume-review-results";
import type { ResumeReviewResult } from "@/types/resume-review";

const REVIEW_DURATION = 2000;

export function ResumeReviewPanel() {
  const t = useTranslations("dashboard.resumeReview");

  const [resumes, setResumes] = useState<ResumeLibraryItem[]>([]);
  const [selectedResumePath, setSelectedResumePath] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<ResumeReviewResult | null>(
    null,
  );

  useEffect(() => {
    getResumeLibrary().then(setResumes);
  }, []);

  const hasResumes = resumes.length > 0;

  const handleStartReview = async () => {
    if (!selectedResumePath) return;

    setIsReviewing(true);
    setReviewResult(null);

    await new Promise((resolve) => {
      window.setTimeout(resolve, REVIEW_DURATION);
    });

    const selectedResume = resumes.find(
      (r) => r.filePath === selectedResumePath,
    );
    setReviewResult({
      ...mockResumeReviewResult,
      resumeName:
        selectedResume?.defaultName ?? mockResumeReviewResult.resumeName,
      jdMatchAnalysis: jobDescription.trim()
        ? mockResumeReviewResult.jdMatchAnalysis
        : undefined,
    });
    setIsReviewing(false);
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
                {t("form.reviewingHint")}
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-primary/10">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {reviewResult && <ResumeReviewResults result={reviewResult} />}
    </div>
  );
}

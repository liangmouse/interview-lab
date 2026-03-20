"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  ResumeReviewResult,
  ResumeReviewSection,
} from "@/types/resume-review";

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-500";
}

function scoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-50 border-emerald-200";
  if (score >= 60) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

function ScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg
        className="absolute -rotate-90"
        width="112"
        height="112"
        viewBox="0 0 112 112"
      >
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="10"
        />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className={cn("text-3xl font-bold", scoreColor(score))}>
        {score}
      </span>
    </div>
  );
}

function SectionCard({ section }: { section: ResumeReviewSection }) {
  const t = useTranslations("dashboard.resumeReview.result");
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border",
        open ? "border-[#D0D0D0]" : "border-[#E5E5E5]",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium text-[#141414]">
            {section.sectionName}
          </span>
        </div>
        <Badge
          className={cn(
            "border text-xs font-semibold",
            section.score >= 80
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : section.score >= 60
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-red-200 bg-red-50 text-red-600",
          )}
        >
          {section.score}
        </Badge>
      </button>

      {open && (
        <div className="space-y-4 border-t border-[#F0F0F0] px-4 pb-4 pt-3">
          {section.strengths.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                {t("strengths")}
              </p>
              <ul className="space-y-1">
                {section.strengths.map((s) => (
                  <li
                    key={s}
                    className="flex items-start gap-2 text-sm text-[#141414]"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {section.weaknesses.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                {t("weaknesses")}
              </p>
              <ul className="space-y-1">
                {section.weaknesses.map((w) => (
                  <li
                    key={w}
                    className="flex items-start gap-2 text-sm text-[#141414]"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {section.suggestions.length > 0 && (
            <div className="space-y-3">
              {section.suggestions.map((suggestion, i) => (
                <div
                  key={i}
                  className="space-y-1.5 rounded-lg border border-[#E5E5E5] p-3"
                >
                  <div className="rounded bg-red-50 px-3 py-2">
                    <p className="mb-0.5 text-xs font-medium text-red-600">
                      {t("before")}
                    </p>
                    <p className="text-sm text-red-800 line-through">
                      {suggestion.original}
                    </p>
                  </div>
                  <div className="rounded bg-emerald-50 px-3 py-2">
                    <p className="mb-0.5 text-xs font-medium text-emerald-700">
                      {t("after")}
                    </p>
                    <p className="text-sm text-emerald-900">
                      {suggestion.improved}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{t("reason")}：</span>
                    {suggestion.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ResumeReviewResults({
  result,
}: {
  result: ResumeReviewResult;
}) {
  const t = useTranslations("dashboard.resumeReview.result");

  return (
    <div className="space-y-4">
      {/* Overall score card */}
      <Card className="border-[#E5E5E5] bg-white">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex flex-col items-center gap-1">
              <ScoreRing score={result.overallScore} />
              <p className="text-xs text-muted-foreground">
                {t("overallScore")}
              </p>
            </div>
            <div className="flex-1">
              <p className="mb-1.5 font-semibold text-[#141414]">
                {t("overallAssessment")}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {result.overallAssessment}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section cards */}
      <Card className="border-[#E5E5E5] bg-white">
        <CardContent className="space-y-2 pt-6">
          {result.sections.map((section) => (
            <SectionCard key={section.sectionName} section={section} />
          ))}
        </CardContent>
      </Card>

      {/* ATS compatibility */}
      <Card className="border-[#E5E5E5] bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-[#141414]">
            {t("atsTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Progress
              value={result.atsCompatibility.score}
              className="h-2 flex-1"
            />
            <span
              className={cn(
                "text-sm font-semibold",
                scoreColor(result.atsCompatibility.score),
              )}
            >
              {result.atsCompatibility.score}
            </span>
          </div>
          {result.atsCompatibility.issues.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                {t("weaknesses")}
              </p>
              <ul className="space-y-1">
                {result.atsCompatibility.issues.map((issue) => (
                  <li
                    key={issue}
                    className="flex items-start gap-2 text-sm text-[#141414]"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.atsCompatibility.recommendations.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                {t("strengths")}
              </p>
              <ul className="space-y-1">
                {result.atsCompatibility.recommendations.map((rec) => (
                  <li
                    key={rec}
                    className="flex items-start gap-2 text-sm text-[#141414]"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* JD match */}
      {result.jdMatchAnalysis && (
        <Card className="border-[#E5E5E5] bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-[#141414]">
              {t("jdMatchTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Progress
                value={result.jdMatchAnalysis.matchScore}
                className="h-2 flex-1"
              />
              <span
                className={cn(
                  "text-sm font-semibold",
                  scoreColor(result.jdMatchAnalysis.matchScore),
                )}
              >
                {result.jdMatchAnalysis.matchScore}
              </span>
            </div>

            {result.jdMatchAnalysis.matchedKeywords.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {t("matchedKeywords")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.jdMatchAnalysis.matchedKeywords.map((kw) => (
                    <Badge
                      key={kw}
                      className="border border-emerald-200 bg-emerald-50 text-emerald-700"
                    >
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {result.jdMatchAnalysis.missingKeywords.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  {t("missingKeywords")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.jdMatchAnalysis.missingKeywords.map((kw) => (
                    <Badge
                      key={kw}
                      className="border border-amber-200 bg-amber-50 text-amber-700"
                    >
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {result.jdMatchAnalysis.recommendations.length > 0 && (
              <ul className="space-y-1">
                {result.jdMatchAnalysis.recommendations.map((rec) => (
                  <li
                    key={rec}
                    className="flex items-start gap-2 text-sm text-[#141414]"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {rec}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

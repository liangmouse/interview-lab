"use client";

import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface InterviewResumePanelProps {
  resumeUrl: string | null;
}

export function InterviewResumePanel({ resumeUrl }: InterviewResumePanelProps) {
  const t = useTranslations("interview");

  return (
    <aside className="flex h-full w-full flex-col border-r border-[#E5E7EB] bg-white">
      <header className="flex h-14 items-center justify-between border-b border-[#E5E7EB] px-4">
        <div className="flex items-center gap-2 text-sm font-medium text-[#141414]">
          <FileText className="h-4 w-4 text-[#64748B]" />
          <span>{t("resumePanelTitle")}</span>
        </div>

        {resumeUrl ? (
          <Button asChild variant="ghost" size="sm" className="h-8">
            <a
              href={resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("openResumeInNewTab")}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 bg-[#F8FAFC]">
        {resumeUrl ? (
          <iframe
            title={t("resumePreviewTitle")}
            src={`${resumeUrl}#toolbar=0&navpanes=0`}
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#6B7280]">
            {t("resumeUnavailable")}
          </div>
        )}
      </div>
    </aside>
  );
}

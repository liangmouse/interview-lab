"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FullInterviewPanel } from "@/components/interview/full-interview-panel";
import { FocusInterviewPanel } from "@/components/interview/focus-interview-panel";
import {
  buildInterviewModeHref,
  normalizeInterviewMode,
} from "@/lib/interview-mode";

export function InterviewModeTabs() {
  const t = useTranslations("dashboard.pages");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = normalizeInterviewMode(searchParams.get("mode"));

  const handleModeChange = (nextMode: string) => {
    const normalized = normalizeInterviewMode(nextMode);
    if (normalized === mode) return;
    router.replace(buildInterviewModeHref(pathname, normalized, searchParams));
  };

  return (
    <Tabs value={mode} onValueChange={handleModeChange} className="gap-6">
      <TabsList className="h-10">
        <TabsTrigger value="full">{t("fullInterview")}</TabsTrigger>
        <TabsTrigger value="focus">{t("focusInterview")}</TabsTrigger>
      </TabsList>

      <TabsContent value="full">
        <FullInterviewPanel />
      </TabsContent>

      <TabsContent value="focus">
        <FocusInterviewPanel />
      </TabsContent>
    </Tabs>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionPlaceholder } from "@/components/dashboard/section-placeholder";
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

  const modeTabs = (
    <TabsList className="h-10">
      <TabsTrigger value="full">{t("fullInterview")}</TabsTrigger>
      <TabsTrigger value="focus">{t("focusInterview")}</TabsTrigger>
    </TabsList>
  );

  return (
    <Tabs value={mode} onValueChange={handleModeChange} className="gap-4">
      <TabsContent value="full">
        <SectionPlaceholder
          title={t("fullInterview")}
          description={t("fullInterviewDesc")}
          actionLabel={t("backToDashboard")}
          headerExtra={modeTabs}
        />
      </TabsContent>

      <TabsContent value="focus">
        <SectionPlaceholder
          title={t("focusInterview")}
          description={t("focusInterviewDesc")}
          actionLabel={t("backToDashboard")}
          headerExtra={modeTabs}
        />
      </TabsContent>
    </Tabs>
  );
}

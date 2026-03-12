import { getTranslations } from "next-intl/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SectionPlaceholder } from "@/components/dashboard/section-placeholder";

export default async function InterviewArchivePage() {
  const t = await getTranslations("dashboard.pages");

  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { labelKey: "title", href: "/dashboard" },
          { labelKey: "dashboard.pages.interviewArchive" },
        ]}
      />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <SectionPlaceholder
          title={t("interviewArchive")}
          description={t("interviewArchiveDesc")}
          actionLabel={t("backToDashboard")}
        />
      </main>
    </>
  );
}

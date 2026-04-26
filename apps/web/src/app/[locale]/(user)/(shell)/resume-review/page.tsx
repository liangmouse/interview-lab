import { listResumeReviewJobsForUser } from "@interviewclaw/data-access";
import { getTranslations } from "next-intl/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ResumeReviewPanel } from "@/components/dashboard/resume-review-panel";
import { createClient } from "@/lib/supabase/server";

export default async function ResumeReviewPage() {
  const t = await getTranslations("dashboard.pages");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const initialReviewJobs = user
    ? await listResumeReviewJobsForUser(user.id, 20, supabase).catch(() => [])
    : [];
  console.info("[resume-review-page] server render", {
    userId: user?.id ?? null,
    jobCount: initialReviewJobs.length,
  });

  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { labelKey: "title", href: "/dashboard" },
          { labelKey: "dashboard.pages.resumeReview" },
        ]}
      />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <section className="mx-auto w-full max-w-5xl space-y-2 pb-4">
          <h1 className="text-2xl font-semibold text-[#141414] lg:text-3xl">
            {t("resumeReview")}
          </h1>
          <p className="text-muted-foreground">{t("resumeReviewDesc")}</p>
        </section>
        <section className="mx-auto w-full max-w-5xl pb-10">
          <ResumeReviewPanel initialReviewJobs={initialReviewJobs} />
        </section>
      </main>
    </>
  );
}

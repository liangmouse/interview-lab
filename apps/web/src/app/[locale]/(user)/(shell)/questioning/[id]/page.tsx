import { notFound } from "next/navigation";
import { getQuestioningJobForUser } from "@interviewclaw/data-access";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { QuestioningReportDetail } from "@/components/dashboard/questioning-report-detail";
import { createClient } from "@/lib/supabase/server";

interface QuestioningReportDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuestioningReportDetailPage({
  params,
}: QuestioningReportDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const job = await getQuestioningJobForUser(id, user.id, supabase);
  const report = job?.result;

  if (!report) {
    notFound();
  }

  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { labelKey: "title", href: "/dashboard" },
          {
            labelKey: "dashboard.pages.questioningCenter",
            href: "/questioning",
          },
        ]}
      />
      <QuestioningReportDetail report={report} />
    </>
  );
}

import { notFound } from "next/navigation";
import { getJobRecommendationJobForUser } from "@interviewclaw/data-access";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { JobRecommendationDetail } from "@/components/dashboard/job-recommendation-detail";
import { createClient } from "@/lib/supabase/server";

interface JobRecommendationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function JobRecommendationDetailPage({
  params,
}: JobRecommendationDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const job = await getJobRecommendationJobForUser(id, user.id, supabase);
  const result = job?.result;

  if (!result) {
    notFound();
  }

  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { labelKey: "title", href: "/dashboard" },
          { label: "岗位推荐", href: "/job-recommendations" },
          { label: "结果详情" },
        ]}
      />
      <JobRecommendationDetail result={result} />
    </>
  );
}

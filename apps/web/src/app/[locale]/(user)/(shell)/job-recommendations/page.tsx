import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { JobRecommendationPanel } from "@/components/dashboard/job-recommendation-panel";

export default function JobRecommendationsPage() {
  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { labelKey: "title", href: "/dashboard" },
          { label: "岗位推荐" },
        ]}
      />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <section className="mx-auto w-full max-w-6xl space-y-2 pb-4">
          <h1 className="text-2xl font-semibold text-[#141414] lg:text-3xl">
            岗位推荐
          </h1>
          <p className="text-muted-foreground">
            基于你的用户画像、最近简历和手动筛选条件，生成更贴近背景的岗位推荐。
          </p>
        </section>
        <section className="mx-auto w-full max-w-6xl pb-10">
          <JobRecommendationPanel />
        </section>
      </main>
    </>
  );
}

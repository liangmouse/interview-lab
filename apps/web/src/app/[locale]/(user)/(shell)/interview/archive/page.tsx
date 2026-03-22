import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { InterviewArchiveView } from "@/components/interview/interview-archive-view";

export default async function InterviewArchivePage() {
  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { labelKey: "title", href: "/dashboard" },
          { labelKey: "dashboard.pages.interviewArchive" },
        ]}
      />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              面试档案
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              管理你的模拟历史、复盘记录和阶段性结论。
            </p>
          </div>
          <InterviewArchiveView />
        </div>
      </main>
    </>
  );
}

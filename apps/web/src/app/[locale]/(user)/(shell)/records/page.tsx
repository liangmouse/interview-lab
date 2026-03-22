import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { RecordsView } from "@/components/interview/records-view";

export default async function RecordsPage() {
  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { labelKey: "title", href: "/dashboard" },
          { labelKey: "dashboard.pages.records" },
        ]}
      />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              面试记录
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              查看历史场次、评分变化和关键表现趋势。
            </p>
          </div>
          <RecordsView />
        </div>
      </main>
    </>
  );
}

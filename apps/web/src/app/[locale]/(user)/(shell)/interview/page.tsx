import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { InterviewModeTabs } from "@/components/dashboard/interview-mode-tabs";

export default async function InterviewPage() {
  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { labelKey: "title", href: "/dashboard" },
          { labelKey: "dashboard.pages.interview" },
        ]}
      />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <InterviewModeTabs />
      </main>
    </>
  );
}

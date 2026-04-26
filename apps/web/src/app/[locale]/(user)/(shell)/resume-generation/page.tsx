import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ResumeGenerationPanel } from "@/components/dashboard/resume-generation-panel";

export default function ResumeGenerationPage() {
  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { labelKey: "title", href: "/dashboard" },
          { label: "简历工坊" },
        ]}
      />
      <main className="flex-1 overflow-y-auto bg-[#F6F4EE] p-3 sm:p-4 lg:p-6">
        <section className="mx-auto w-full max-w-5xl pb-6">
          <ResumeGenerationPanel />
        </section>
      </main>
    </>
  );
}

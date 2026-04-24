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
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <section className="mx-auto w-full max-w-6xl space-y-2 pb-4">
          <h1 className="text-2xl font-semibold text-[#141414] lg:text-3xl">
            简历工坊
          </h1>
          <p className="text-muted-foreground">
            从已有简历出发，通过分步补问沉淀用户画像，生成更适合目标方向的
            Markdown 简历。
          </p>
        </section>
        <section className="mx-auto w-full max-w-6xl pb-10">
          <ResumeGenerationPanel />
        </section>
      </main>
    </>
  );
}

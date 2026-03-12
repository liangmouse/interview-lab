import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getQuestioningReportById,
  questioningReportHistory,
} from "@/lib/questioning-center";

interface QuestioningReportDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function QuestioningReportDetailPage({
  params,
}: QuestioningReportDetailPageProps) {
  const { id } = await params;
  const t = await getTranslations("dashboard.questioning");
  const report = getQuestioningReportById(id, questioningReportHistory);

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
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <section className="mx-auto w-full max-w-4xl">
          <Card className="border-[#E5E5E5] bg-white">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {report.track === "social"
                    ? t("tracks.social")
                    : t("tracks.campus")}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {report.createdAt}
                </span>
              </div>
              <CardTitle className="mt-2 text-2xl text-[#141414]">
                {report.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("detail.targetRole")}
                </p>
                <p className="mt-1 text-base font-medium text-[#141414]">
                  {report.targetRole}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("detail.summary")}
                </p>
                <p className="mt-1 text-base text-[#141414]">
                  {report.summary}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("detail.focus")}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {report.highlights.map((highlight) => (
                    <Badge key={highlight} variant="outline">
                      {highlight}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}

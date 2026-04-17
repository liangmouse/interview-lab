"use client";

import type { JobRecommendationResult } from "@interviewclaw/domain";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

function renderQueryValue(values: string[]) {
  return values.length > 0 ? values.join("、") : "不限";
}

export function JobRecommendationDetail({
  result,
}: {
  result: JobRecommendationResult;
}) {
  return (
    <main className="flex-1 overflow-y-auto p-6 lg:p-8">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10">
        <Card className="border-[#E8ECE9] bg-white">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-[#141414]">
              岗位推荐结果
            </CardTitle>
            <p className="text-sm text-[#5F6B66]">
              生成时间：{formatDateTime(result.createdAt)}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] p-4">
                <p className="text-xs text-[#6B7B74]">岗位</p>
                <p className="mt-2 text-sm font-medium text-[#141414]">
                  {result.inferredQuery.role || "未限定"}
                </p>
              </div>
              <div className="rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] p-4">
                <p className="text-xs text-[#6B7B74]">城市</p>
                <p className="mt-2 text-sm font-medium text-[#141414]">
                  {renderQueryValue(result.inferredQuery.cities)}
                </p>
              </div>
              <div className="rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] p-4">
                <p className="text-xs text-[#6B7B74]">期望薪资</p>
                <p className="mt-2 text-sm font-medium text-[#141414]">
                  {result.inferredQuery.salaryRange
                    ? `${result.inferredQuery.salaryRange.minK ?? "?"}-${result.inferredQuery.salaryRange.maxK ?? "?"}K`
                    : "不限"}
                </p>
              </div>
              <div className="rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] p-4">
                <p className="text-xs text-[#6B7B74]">行业</p>
                <p className="mt-2 text-sm font-medium text-[#141414]">
                  {renderQueryValue(result.inferredQuery.industries)}
                </p>
              </div>
              <div className="rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] p-4">
                <p className="text-xs text-[#6B7B74]">公司大小</p>
                <p className="mt-2 text-sm font-medium text-[#141414]">
                  {renderQueryValue(result.inferredQuery.companySizes)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E8ECE9] bg-[#F7FAF8] p-5">
              <p className="text-xs font-medium tracking-[0.12em] text-[#6B7B74]">
                推荐总结
              </p>
              <p className="mt-3 text-sm leading-7 text-[#1E302A]">
                {result.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {result.inferredQuery.reasoning.map((item) => (
                  <Badge
                    key={item}
                    variant="outline"
                    className="border-[#D8E6DE] bg-white text-[#315747]"
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <section className="grid gap-4">
          {result.jobs.map((job) => (
            <Card key={job.sourceJobId} className="border-[#E8ECE9] bg-white">
              <CardHeader className="gap-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-xl font-semibold text-[#141414]">
                      {job.title}
                    </CardTitle>
                    <p className="text-sm text-[#4F5F58]">
                      {job.companyName}
                      {job.city ? ` · ${job.city}` : ""}
                      {job.salaryText ? ` · ${job.salaryText}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#173D31] text-white">
                      匹配度 {job.matchScore}
                    </Badge>
                    {job.url ? (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-[#1E5D47] underline underline-offset-4"
                      >
                        打开职位
                      </a>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[job.industry, job.companySize, job.experience, job.degree]
                    .filter(Boolean)
                    .map((item) => (
                      <Badge
                        key={item}
                        variant="outline"
                        className="border-[#D8E6DE] bg-[#F8FBF9] text-[#315747]"
                      >
                        {item}
                      </Badge>
                    ))}
                  {job.tags.map((item) => (
                    <Badge
                      key={item}
                      variant="outline"
                      className="border-[#E7ECE9] bg-white text-[#4F5F58]"
                    >
                      {item}
                    </Badge>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#E8ECE9] bg-[#FAFCFB] p-4">
                    <p className="text-sm font-medium text-[#173D31]">
                      推荐理由
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-[#1E302A]">
                      {job.matchReasons.map((reason) => (
                        <li key={reason}>- {reason}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-[#F0E5D9] bg-[#FFF9F3] p-4">
                    <p className="text-sm font-medium text-[#8B5A24]">
                      风险提示
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-[#6A4B28]">
                      {(job.cautions.length > 0
                        ? job.cautions
                        : ["当前未发现明显风险，可进一步手动核对 JD。"]
                      ).map((reason) => (
                        <li key={reason}>- {reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </section>
    </main>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { ArrowRight, Clock, SlidersHorizontal, Sparkles } from "lucide-react";

export function QuickStartCard() {
  const t = useTranslations("dashboard.simulation");
  const router = useRouter();

  const handleOpenInterviewConfig = () => {
    router.push("/interview");
  };

  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-10 shadow-sm lg:p-12">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <div className="mx-auto w-full max-w-4xl space-y-2">
          <h2 className="text-2xl font-light text-[#141414] lg:text-3xl">
            {t("title")}
          </h2>
          <p className="text-[#525252]">{t("description")}</p>
        </div>

        <div className="mx-auto grid w-full max-w-4xl gap-3 md:grid-cols-3">
          <div className="flex items-start gap-3 rounded-md border border-[#E5E5E5] bg-[#FAFAFA] p-4">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#0F3E2E]" />
            <div>
              <p className="text-sm font-medium text-[#141414]">选择面试模式</p>
              <p className="mt-1 text-sm text-[#525252]">
                支持综合面试和专项训练。
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md border border-[#E5E5E5] bg-[#FAFAFA] p-4">
            <SlidersHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-[#0F3E2E]" />
            <div>
              <p className="text-sm font-medium text-[#141414]">配置岗位方向</p>
              <p className="mt-1 text-sm text-[#525252]">
                在面试页选择主题、难度和专项能力。
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-md border border-[#E5E5E5] bg-[#FAFAFA] p-4">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#0F3E2E]" />
            <div>
              <p className="text-sm font-medium text-[#141414]">
                个性化定制面试内容
              </p>
              <p className="mt-1 text-sm text-[#525252]">
                根据岗位方向和能力目标生成专属练习。
              </p>
            </div>
          </div>
        </div>

        <Button
          size="lg"
          onClick={handleOpenInterviewConfig}
          className="mx-auto flex h-12 w-full max-w-4xl cursor-pointer bg-[#0F3E2E] text-base font-normal text-white hover:bg-[#0F3E2E]/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          去配置面试
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

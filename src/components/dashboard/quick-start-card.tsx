"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  createInterview,
  type InterviewTopic,
  type InterviewDifficulty,
} from "@/action/create-interview";
import { toast } from "sonner";

export function QuickStartCard() {
  const t = useTranslations("dashboard.simulation");
  const router = useRouter();

  const [topic, setTopic] = useState<InterviewTopic | "">("");
  const [difficulty, setDifficulty] = useState<InterviewDifficulty | "">("");
  const [duration, setDuration] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  // useTransition 追踪导航状态
  const [isPending, startTransition] = useTransition();

  // 综合 loading 状态：API 调用中 或 导航中
  const isBusy = isLoading || isPending;

  // 开始面试
  const handleStartInterview = useCallback(async () => {
    // 验证表单
    if (!topic) {
      toast.error("请选择面试主题");
      console.log("topic", topic);
      return;
    }
    if (!difficulty) {
      toast.error("请选择面试难度");
      console.log("difficulty", difficulty);
      return;
    }
    if (!duration) {
      toast.error("请选择面试时长");
      console.log("duration", duration);
      return;
    }

    setIsLoading(true);

    try {
      const result = await createInterview({ topic, difficulty, duration });

      if (result.error) {
        toast.error(result.error);
        setIsLoading(false);
        return;
      }

      if (result.interviewId) {
        // API 调用完成，重置 isLoading
        setIsLoading(false);
        // 使用 startTransition 包裹导航，isPending 会自动追踪导航状态
        startTransition(() => {
          router.push(`/interview/${result.interviewId}`);
        });
      }
    } catch (err) {
      console.error("Failed to start interview:", err);
      toast.error("启动面试失败，请重试");
      setIsLoading(false);
    }
  }, [topic, difficulty, duration, router]);

  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-10 shadow-sm lg:p-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-light text-[#141414] lg:text-3xl">
            {t("title")}
          </h2>
          <p className="text-[#666666]">{t("description")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-[#666666]">
              {t("topic")}
            </label>
            <Select
              value={topic}
              onValueChange={(value) => setTopic(value as InterviewTopic)}
            >
              <SelectTrigger className="border-[#E5E5E5] bg-white text-[#141414] h-12">
                <SelectValue placeholder={t("selectTopic")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="frontend">{t("topics.frontend")}</SelectItem>
                <SelectItem value="backend">{t("topics.backend")}</SelectItem>
                <SelectItem value="fullstack">
                  {t("topics.fullstack")}
                </SelectItem>
                <SelectItem value="mobile">{t("topics.mobile")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-[#666666]">
              {t("difficulty")}
            </label>
            <Select
              value={difficulty}
              onValueChange={(value) =>
                setDifficulty(value as InterviewDifficulty)
              }
            >
              <SelectTrigger className="border-[#E5E5E5] bg-white text-[#141414] h-12">
                <SelectValue placeholder={t("selectDifficulty")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">
                  {t("difficulties.beginner")}
                </SelectItem>
                <SelectItem value="intermediate">
                  {t("difficulties.intermediate")}
                </SelectItem>
                <SelectItem value="advanced">
                  {t("difficulties.advanced")}
                </SelectItem>
                <SelectItem value="expert">
                  {t("difficulties.expert")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-[#666666]">
              {t("duration")}
            </label>
            <Select
              value={duration?.toString()}
              onValueChange={(value) => setDuration(parseInt(value))}
            >
              <SelectTrigger className="border-[#E5E5E5] bg-white text-[#141414] h-12">
                <SelectValue placeholder={t("selectDuration")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 min</SelectItem>
                <SelectItem value="25">25 min</SelectItem>
                <SelectItem value="40">40 min</SelectItem>
                <SelectItem value="60">60 min</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 开始面试按钮 */}
        <Button
          size="lg"
          onClick={handleStartInterview}
          disabled={isBusy}
          className="w-full bg-[#0F3E2E] text-base font-normal text-white hover:bg-[#0F3E2E]/90 h-12 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isBusy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isLoading ? "正在创建面试..." : "正在跳转..."}
            </>
          ) : (
            t("startButton")
          )}
        </Button>
      </div>
    </div>
  );
}

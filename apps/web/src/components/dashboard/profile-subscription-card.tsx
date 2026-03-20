"use client";

import { useMemo, useState } from "react";
import { Check, CreditCard, Sparkles, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PlanKey = "free" | "starter" | "pro";

interface PlanData {
  key: PlanKey;
  price: string;
  popular?: boolean;
  features: string[];
}

export function ProfileSubscriptionCard() {
  const t = useTranslations("profile.center.subscription");
  const [open, setOpen] = useState(false);

  const plans = useMemo<PlanData[]>(
    () => [
      {
        key: "free",
        price: t("plans.free.price"),
        features: t.raw("plans.free.features") as string[],
      },
      {
        key: "starter",
        price: t("plans.starter.price"),
        features: t.raw("plans.starter.features") as string[],
      },
      {
        key: "pro",
        price: t("plans.pro.price"),
        popular: true,
        features: t.raw("plans.pro.features") as string[],
      },
    ],
    [t],
  );

  const currentPlan: PlanKey = "free";

  return (
    <>
      <Card className="border-[#E5E5E5] bg-white shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div className="rounded-xl border border-[#E5E5E5] bg-gradient-to-br from-[#F8FBFA] to-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F3E2E]/10">
                <Sparkles
                  aria-hidden="true"
                  className="h-4.5 w-4.5 text-[#0F3E2E]"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#0F3E2E]" />
                <span className="h-2 w-2 rounded-full bg-[#0F3E2E]/60" />
                <span className="h-2 w-2 rounded-full bg-[#0F3E2E]/25" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-2 w-full rounded-full bg-[#0F3E2E]/10" />
              <div className="h-2 w-4/5 rounded-full bg-[#0F3E2E]/10" />
              <div className="h-2 w-3/5 rounded-full bg-[#0F3E2E]/10" />
            </div>
          </div>
          <Button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full bg-[#0F3E2E] text-white hover:bg-[#0F3E2E]/90"
          >
            <CreditCard aria-hidden="true" className="mr-1.5 h-4 w-4" />
            {t("entry")}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        {/*
          16:9 宽屏容器：宽度取 min(90vw, 900px)，高度由 aspect-video 锁定为 9/16 倍宽度。
          内容不超出时无滚动条。
        */}
        <DialogContent className="w-[min(95vw,860px)] max-w-none sm:max-w-none overflow-hidden border-[#E5E5E5] p-0">
          <div className="flex flex-col px-8 py-6 gap-5">
            {/* Header */}
            <DialogHeader className="shrink-0 space-y-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <DialogTitle className="text-lg font-bold tracking-tight text-[#141414]">
                    {t("modal.title")}
                  </DialogTitle>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-[#0F3E2E]/20 bg-[#0F3E2E]/5 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0F3E2E]" />
                  <span className="text-xs font-medium text-[#0F3E2E]">
                    {t("modal.currentLabel")}
                    {t(`plans.${currentPlan}.name`)}
                  </span>
                </div>
              </div>
            </DialogHeader>

            {/* 3-column plan cards — fill remaining height */}
            <div className="grid grid-cols-3 gap-4">
              {plans.map((plan) => {
                const isCurrent = plan.key === currentPlan;
                return (
                  <div
                    key={plan.key}
                    className={cn(
                      "relative flex flex-col rounded-2xl border bg-white overflow-hidden transition-shadow",
                      plan.popular
                        ? "border-[#0F3E2E] shadow-lg shadow-[#0F3E2E]/15"
                        : "border-[#EBEBEB] hover:shadow-sm",
                      isCurrent && "ring-2 ring-[#0F3E2E]/20",
                    )}
                  >
                    {/* Popular badge */}
                    {plan.popular && (
                      <div className="absolute -top-px left-1/2 -translate-x-1/2">
                        <span className="inline-flex items-center gap-1 rounded-b-lg bg-amber-400 px-3 py-0.5 text-[11px] font-semibold text-amber-900">
                          <Zap aria-hidden="true" className="h-2.5 w-2.5" />
                          {t("modal.popular")}
                        </span>
                      </div>
                    )}

                    {/* Plan header area */}
                    <div className="shrink-0 px-5 pt-6 pb-4 bg-[#FAFAFA]">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#BBBBBB]">
                        {t(`plans.${plan.key}.name`)}
                      </p>
                      <div className="mt-1.5 flex items-end gap-1">
                        <span className="text-3xl font-bold tabular-nums leading-none text-[#141414]">
                          {plan.price}
                        </span>
                        {plan.key !== "free" && (
                          <span className="mb-0.5 text-xs text-[#CCCCCC]">
                            /mo
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-[#BBBBBB]">
                        {t(`plans.${plan.key}.desc`)}
                      </p>
                    </div>

                    {/* Divider */}
                    <div className="h-px shrink-0 bg-[#F0F0F0]" />

                    {/* Features — scrollable if overflow */}
                    <ul className="px-5 py-4 space-y-2.5">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <span
                            className={cn(
                              "mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full",
                              "bg-[#0F3E2E]/10",
                            )}
                          >
                            <Check
                              aria-hidden="true"
                              className={cn("h-2 w-2", "text-[#0F3E2E]")}
                              strokeWidth={3}
                            />
                          </span>
                          <span
                            className={cn(
                              "text-[12px] leading-[1.5]",
                              "text-[#555555]",
                            )}
                          >
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <div className="shrink-0 px-5 pb-5 pt-3">
                      <Button
                        variant={isCurrent ? "outline" : "default"}
                        className={cn(
                          "h-9 w-full rounded-xl text-[13px] font-medium transition-all",
                          isCurrent
                            ? "cursor-default border-[#E5E5E5] text-[#CCCCCC]"
                            : "border-0 bg-[#0F3E2E] text-white hover:bg-[#0F3E2E]/90",
                        )}
                        disabled={isCurrent}
                        onClick={() => {
                          toast.success(t("modal.comingSoon"));
                        }}
                      >
                        {isCurrent
                          ? t("modal.currentPlanBtn")
                          : t("modal.selectPlanBtn")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

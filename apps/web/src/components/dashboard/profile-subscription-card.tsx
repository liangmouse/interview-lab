"use client";

import { useMemo, useState } from "react";
import { Check, CreditCard, Sparkles } from "lucide-react";
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

type PlanKey = "free" | "starter" | "pro" | "champion";

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
      {
        key: "champion",
        price: t("plans.champion.price"),
        features: t.raw("plans.champion.features") as string[],
      },
    ],
    [t],
  );

  const currentPlan: PlanKey = "free";

  return (
    <>
      <Card className="border-[#E5E5E5] bg-white shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div className="rounded-xl border border-[#E5E5E5] bg-linear-to-br from-[#F8FBFA] to-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F3E2E]/10">
                <Sparkles className="h-4.5 w-4.5 text-[#0F3E2E]" />
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
            <CreditCard className="mr-1.5 h-4 w-4" />
            {t("entry")}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-6xl overflow-auto border-[#E5E5E5] p-5 sm:p-6">
          <DialogHeader className="mb-2 flex flex-row items-start justify-between gap-4 text-left">
            <div>
              <DialogTitle className="text-2xl font-semibold text-[#141414]">
                {t("modal.title")}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-[#666666]">
                {t("modal.subtitle")}
              </DialogDescription>
            </div>
            <div className="text-right">
              <p className="text-base font-semibold text-[#141414]">
                {t("modal.currentLabel")}
                <span className="ml-1 text-[#0F3E2E]">
                  {t(`plans.${currentPlan}.name`)}
                </span>
              </p>
              <p className="text-xs text-[#999999]">{t("modal.renewAt")}</p>
            </div>
          </DialogHeader>

          <div className="mt-4 grid gap-5 lg:grid-cols-4">
            {plans.map((plan) => {
              const isCurrent = plan.key === currentPlan;
              return (
                <div
                  key={plan.key}
                  className={cn(
                    "relative rounded-xl border bg-white p-4",
                    plan.popular
                      ? "border-[#0F3E2E] shadow-[0_0_0_1px_#0F3E2E20]"
                      : "border-[#E5E5E5]",
                  )}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0F3E2E] px-3 py-1 text-xs font-medium text-white">
                      <Sparkles className="mr-1 inline h-3.5 w-3.5" />
                      {t("modal.popular")}
                    </div>
                  )}

                  <p className="mt-4 text-center text-2xl font-semibold text-[#141414]">
                    {t(`plans.${plan.key}.name`)}
                  </p>
                  <p className="mt-2 text-center text-4xl font-semibold leading-none text-[#141414]">
                    {plan.price}
                    {plan.key !== "free" && (
                      <span className="ml-1 text-lg font-medium text-[#666666]">
                        /mo
                      </span>
                    )}
                  </p>
                  <p className="mt-3 min-h-[64px] text-center text-sm leading-6 text-[#666666]">
                    {t(`plans.${plan.key}.desc`)}
                  </p>

                  <ul className="mt-3 space-y-2">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-[#555555]"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0F3E2E]" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={isCurrent ? "outline" : "default"}
                    className={cn(
                      "mt-4 h-9 w-full text-sm",
                      isCurrent
                        ? "border-[#E5E5E5] text-[#666666]"
                        : "bg-[#0F3E2E] text-white hover:bg-[#0F3E2E]/90",
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
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

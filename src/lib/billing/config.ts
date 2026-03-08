import type { BillingPlanDefinition, PlanKey } from "@/types/billing";

const PLAN_PRICE_ENV_MAP: Record<PlanKey, string> = {
  weekly: "BILLING_WEEKLY_PRICE_LABEL",
  monthly: "BILLING_MONTHLY_PRICE_LABEL",
};

export function getPlanPriceLabel(planKey: PlanKey) {
  return process.env[PLAN_PRICE_ENV_MAP[planKey]] || "待配置";
}

export const BILLING_PLANS: BillingPlanDefinition[] = [
  {
    key: "weekly",
    title: "周会员",
    description: "适合短期冲刺，解锁无限模拟与完整报告。",
    intervalLabel: "每周自动续费",
    priceLabel: getPlanPriceLabel("weekly"),
  },
  {
    key: "monthly",
    title: "月会员",
    description: "适合持续练习，解锁个性化定制与完整报告。",
    intervalLabel: "每月自动续费",
    priceLabel: getPlanPriceLabel("monthly"),
    recommended: true,
  },
];

export function getStripePriceId(planKey: PlanKey) {
  const envName =
    planKey === "weekly"
      ? "STRIPE_PRICE_ID_WEEKLY"
      : "STRIPE_PRICE_ID_MONTHLY";
  return process.env[envName];
}

export function getPlanAmountCents(planKey: PlanKey) {
  const envName =
    planKey === "weekly"
      ? "BILLING_WEEKLY_AMOUNT_CENTS"
      : "BILLING_MONTHLY_AMOUNT_CENTS";
  const value = process.env[envName];
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getBillingBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

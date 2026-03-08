export type PlanKey = "weekly" | "monthly";

export type BillingProvider = "antom" | "stripe";

export type BillingCheckoutMethod = "alipay" | "card";

export type AccessTier = "free" | "premium";

export type BillingSubscriptionStatus =
  | "inactive"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";

export type PersonalizationMode = "generic" | "resume" | "jd";

export interface BillingPlanDefinition {
  key: PlanKey;
  title: string;
  description: string;
  intervalLabel: string;
  priceLabel: string;
  recommended?: boolean;
}

export interface UserAccessState {
  tier: AccessTier;
  trialTotal: number;
  trialUsed: number;
  trialRemaining: number;
  canUsePersonalization: boolean;
  canViewFullReport: boolean;
  subscriptionStatus: BillingSubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  activeSubscriptionId: string | null;
}

export interface BillingCheckoutResult {
  orderId: string;
  provider: BillingProvider;
  checkoutUrl?: string;
  clientSecret?: string;
}

export interface BillingOrderRecord {
  id: string;
  user_id: string;
  provider: BillingProvider;
  plan_key: PlanKey;
  checkout_method: BillingCheckoutMethod;
  status: string;
  amount_cents: number;
  currency: string;
  provider_order_id: string | null;
  provider_subscription_id: string | null;
  checkout_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

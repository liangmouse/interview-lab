import { createClient } from "@/lib/supabase/server";
import type {
  BillingSubscriptionStatus,
  UserAccessState,
} from "@/types/billing";

const DEFAULT_TRIAL_TOTAL = 3;

type SupabaseLikeClient = {
  from: (table: string) => any;
  auth?: {
    getUser?: () => Promise<{ data: { user: { id: string } | null } }>;
  };
};

interface EntitlementRow {
  user_id: string;
  trial_total: number | null;
  trial_used: number | null;
  current_tier: "free" | "premium" | null;
  premium_expires_at: string | null;
  cancel_at_period_end: boolean | null;
  active_subscription_id: string | null;
}

function buildAccessState(row: EntitlementRow | null): UserAccessState {
  const trialTotal = Math.max(row?.trial_total ?? DEFAULT_TRIAL_TOTAL, 0);
  const trialUsed = Math.max(row?.trial_used ?? 0, 0);
  const currentPeriodEnd = row?.premium_expires_at ?? null;
  const hasPremiumWindow =
    !!currentPeriodEnd && new Date(currentPeriodEnd).getTime() > Date.now();
  const tier =
    hasPremiumWindow && row?.current_tier === "premium" ? "premium" : "free";
  const subscriptionStatus: BillingSubscriptionStatus =
    tier === "premium"
      ? "active"
      : row?.current_tier === "premium"
        ? "expired"
        : "inactive";

  return {
    tier,
    trialTotal,
    trialUsed,
    trialRemaining: Math.max(trialTotal - trialUsed, 0),
    canUsePersonalization: tier === "premium",
    canViewFullReport: tier === "premium",
    subscriptionStatus,
    currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    activeSubscriptionId: row?.active_subscription_id ?? null,
  };
}

async function ensureEntitlementRow(
  supabase: SupabaseLikeClient,
  userId: string,
): Promise<EntitlementRow | null> {
  const { data, error } = await supabase
    .from("user_entitlements")
    .select(
      "user_id, trial_total, trial_used, current_tier, premium_expires_at, cancel_at_period_end, active_subscription_id",
    )
    .eq("user_id", userId)
    .single();

  if (!error && data) {
    return data as EntitlementRow;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("user_entitlements")
    .insert({
      user_id: userId,
      trial_total: DEFAULT_TRIAL_TOTAL,
      trial_used: 0,
      current_tier: "free",
      cancel_at_period_end: false,
    })
    .select(
      "user_id, trial_total, trial_used, current_tier, premium_expires_at, cancel_at_period_end, active_subscription_id",
    )
    .single();

  if (insertError) {
    console.error(
      "[billing/access] failed to ensure entitlement row",
      insertError,
    );
    return null;
  }

  return inserted as EntitlementRow;
}

export async function resolveUserAccessForUserId(
  userId: string,
  supabase?: SupabaseLikeClient,
): Promise<UserAccessState> {
  const client = supabase ?? (await createClient());
  const entitlement = await ensureEntitlementRow(client, userId);
  return buildAccessState(entitlement);
}

export async function getCurrentUserAccess(): Promise<UserAccessState | null> {
  const supabase = await createClient();
  const result = await supabase.auth.getUser();
  const user = result.data.user;

  if (!user) {
    return null;
  }

  return resolveUserAccessForUserId(user.id, supabase);
}

export async function requirePremiumAccess(
  message = "当前功能需要会员权限，请先升级",
) {
  const access = await getCurrentUserAccess();
  if (!access || access.tier !== "premium") {
    return { access, error: message };
  }
  return { access };
}

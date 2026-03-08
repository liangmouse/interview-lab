import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  BillingCheckoutMethod,
  BillingOrderRecord,
  BillingProvider,
  BillingSubscriptionStatus,
  PlanKey,
} from "@/types/billing";
import { getPlanAmountCents } from "@/lib/billing/config";

export async function createBillingOrder(params: {
  userId: string;
  provider: BillingProvider;
  planKey: PlanKey;
  checkoutMethod: BillingCheckoutMethod;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabaseAdmin
    .from("billing_orders")
    .insert({
      user_id: params.userId,
      provider: params.provider,
      plan_key: params.planKey,
      checkout_method: params.checkoutMethod,
      amount_cents: getPlanAmountCents(params.planKey),
      metadata: params.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`创建支付订单失败: ${error.message}`);
  }

  return data as BillingOrderRecord;
}

export async function updateBillingOrder(
  orderId: string,
  patch: Record<string, unknown>,
) {
  const { data, error } = await supabaseAdmin
    .from("billing_orders")
    .update(patch)
    .eq("id", orderId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`更新支付订单失败: ${error.message}`);
  }

  return data as BillingOrderRecord;
}

export async function storeWebhookEvent(params: {
  provider: BillingProvider;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const { data, error } = await supabaseAdmin
    .from("billing_webhook_events")
    .insert({
      provider: params.provider,
      event_id: params.eventId,
      event_type: params.eventType,
      payload: params.payload,
    })
    .select("id, processed_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("billing_webhook_events")
        .select("id, processed_at")
        .eq("provider", params.provider)
        .eq("event_id", params.eventId)
        .maybeSingle();

      if (existingError || !existing) {
        throw new Error(
          `读取重复 webhook 事件失败: ${existingError?.message || "事件不存在"}`,
        );
      }

      return {
        duplicated: Boolean(existing.processed_at),
        id: existing.id as string,
      };
    }
    throw new Error(`记录 webhook 失败: ${error.message}`);
  }

  return { duplicated: false, id: data.id as string };
}

export async function markWebhookEventProcessed(eventRecordId: string) {
  const { error } = await supabaseAdmin
    .from("billing_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventRecordId);

  if (error) {
    throw new Error(`更新 webhook 处理状态失败: ${error.message}`);
  }
}

export async function upsertBillingSubscription(params: {
  userId: string;
  provider: BillingProvider;
  planKey: PlanKey;
  providerSubscriptionId: string;
  providerCustomerId?: string | null;
  status: BillingSubscriptionStatus;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabaseAdmin
    .from("billing_subscriptions")
    .upsert(
      {
        user_id: params.userId,
        provider: params.provider,
        plan_key: params.planKey,
        provider_subscription_id: params.providerSubscriptionId,
        provider_customer_id: params.providerCustomerId ?? null,
        status: params.status,
        current_period_start: params.currentPeriodStart ?? null,
        current_period_end: params.currentPeriodEnd ?? null,
        cancel_at_period_end: params.cancelAtPeriodEnd ?? false,
        metadata: params.metadata ?? {},
      },
      { onConflict: "provider_subscription_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`更新订阅失败: ${error.message}`);
  }

  return data;
}

export async function syncEntitlementFromSubscription(params: {
  userId: string;
  subscriptionId: string | null;
  status: BillingSubscriptionStatus;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const isPremium =
    params.status === "active" &&
    !!params.currentPeriodEnd &&
    new Date(params.currentPeriodEnd).getTime() > Date.now();

  const { error } = await supabaseAdmin.from("user_entitlements").upsert(
    {
      user_id: params.userId,
      current_tier: isPremium ? "premium" : "free",
      premium_expires_at: params.currentPeriodEnd ?? null,
      cancel_at_period_end: params.cancelAtPeriodEnd ?? false,
      active_subscription_id: isPremium ? params.subscriptionId : null,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`同步权益失败: ${error.message}`);
  }
}

export async function getActiveSubscriptionForUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "past_due", "canceled"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`读取会员订阅失败: ${error.message}`);
  }

  return data;
}

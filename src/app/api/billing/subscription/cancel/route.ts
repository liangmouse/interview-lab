import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveSubscriptionForUser,
  syncEntitlementFromSubscription,
  upsertBillingSubscription,
} from "@/lib/billing/admin";
import { getStripeClient } from "@/lib/billing/providers/stripe";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "未登录或登录已过期" },
        { status: 401 },
      );
    }

    const subscription = await getActiveSubscriptionForUser(user.id);
    if (!subscription) {
      return NextResponse.json({ error: "未找到有效订阅" }, { status: 404 });
    }

    if (subscription.provider === "stripe") {
      const stripe = getStripeClient();
      const updated = await stripe.subscriptions.update(
        subscription.provider_subscription_id,
        {
          cancel_at_period_end: true,
        },
      );

      const saved = await upsertBillingSubscription({
        userId: user.id,
        provider: "stripe",
        planKey: subscription.plan_key,
        providerSubscriptionId: updated.id,
        providerCustomerId: String(updated.customer),
        status: updated.status === "active" ? "active" : "past_due",
        currentPeriodStart: new Date(
          updated.current_period_start * 1000,
        ).toISOString(),
        currentPeriodEnd: new Date(
          updated.current_period_end * 1000,
        ).toISOString(),
        cancelAtPeriodEnd: updated.cancel_at_period_end,
        metadata: updated.metadata,
      });

      await syncEntitlementFromSubscription({
        userId: user.id,
        subscriptionId: saved.id,
        status: "active",
        currentPeriodEnd: saved.current_period_end,
        cancelAtPeriodEnd: true,
      });

      return NextResponse.json({ success: true });
    }

    const saved = await upsertBillingSubscription({
      userId: user.id,
      provider: "antom",
      planKey: subscription.plan_key,
      providerSubscriptionId: subscription.provider_subscription_id,
      providerCustomerId: subscription.provider_customer_id,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: true,
      metadata: {
        ...(subscription.metadata ?? {}),
        cancelRequestedAt: new Date().toISOString(),
      },
    });

    await syncEntitlementFromSubscription({
      userId: user.id,
      subscriptionId: saved.id,
      status: "active",
      currentPeriodEnd: saved.current_period_end,
      cancelAtPeriodEnd: true,
    });

    return NextResponse.json({
      success: true,
      message: "已标记为到期取消，请同步在 Antom 商户侧关闭自动续费",
    });
  } catch (error) {
    console.error("[billing/subscription/cancel] unexpected error", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "取消续费失败",
      },
      { status: 500 },
    );
  }
}

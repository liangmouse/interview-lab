import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  markWebhookEventProcessed,
  storeWebhookEvent,
  syncEntitlementFromSubscription,
  updateBillingOrder,
  upsertBillingSubscription,
} from "@/lib/billing/admin";
import { getStripeClient } from "@/lib/billing/providers/stripe";

function extractPlanKey(metadata: Record<string, string> | null | undefined) {
  return metadata?.planKey === "weekly" ? "weekly" : "monthly";
}

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripeClient();
    const signature = request.headers.get("stripe-signature");
    const payload = await request.text();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET 未配置");
    }

    if (!signature) {
      return NextResponse.json(
        { error: "缺少 stripe-signature" },
        { status: 400 },
      );
    }

    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    ) as Stripe.Event;

    const stored = await storeWebhookEvent({
      provider: "stripe",
      eventId: event.id,
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>,
    });

    if (stored.duplicated) {
      return NextResponse.json({ received: true, duplicated: true });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await updateBillingOrder(orderId, {
          status: "completed",
          provider_order_id: session.id,
          metadata: session.metadata ?? {},
        });
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const planKey = extractPlanKey(subscription.metadata);
      const currentPeriodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;

      const saved = await upsertBillingSubscription({
        userId: subscription.metadata.userId,
        provider: "stripe",
        planKey,
        providerSubscriptionId: subscription.id,
        providerCustomerId: String(subscription.customer),
        status:
          subscription.status === "active"
            ? "active"
            : subscription.status === "canceled"
              ? "canceled"
              : subscription.status === "past_due"
                ? "past_due"
                : "inactive",
        currentPeriodStart: subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        metadata: subscription.metadata,
      });

      await syncEntitlementFromSubscription({
        userId: subscription.metadata.userId,
        subscriptionId: saved.id,
        status: saved.status,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
    }

    await markWebhookEventProcessed(stored.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[billing/webhooks/stripe] unexpected error", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Stripe webhook 处理失败",
      },
      { status: 400 },
    );
  }
}

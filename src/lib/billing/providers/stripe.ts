import Stripe from "stripe";
import type { PlanKey } from "@/types/billing";
import { getBillingBaseUrl, getStripePriceId } from "@/lib/billing/config";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY 未配置");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-02-24.acacia",
    });
  }

  return stripeClient;
}

export async function createStripeCheckoutSession(params: {
  userId: string;
  email?: string | null;
  planKey: PlanKey;
  orderId: string;
}) {
  const priceId = getStripePriceId(params.planKey);
  if (!priceId) {
    throw new Error(`STRIPE_PRICE_ID_${params.planKey.toUpperCase()} 未配置`);
  }

  const stripe = getStripeClient();
  const baseUrl = getBillingBaseUrl();

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: params.email || undefined,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      userId: params.userId,
      orderId: params.orderId,
      planKey: params.planKey,
    },
    subscription_data: {
      metadata: {
        userId: params.userId,
        orderId: params.orderId,
        planKey: params.planKey,
      },
    },
    success_url: `${baseUrl}/dashboard/profile?billing=success`,
    cancel_url: `${baseUrl}/dashboard/profile?billing=cancel`,
  });
}

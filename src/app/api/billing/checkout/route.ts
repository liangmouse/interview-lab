import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createBillingOrder, updateBillingOrder } from "@/lib/billing/admin";
import { createStripeCheckoutSession } from "@/lib/billing/providers/stripe";
import { createAntomSubscription } from "@/lib/billing/providers/antom";
import type {
  BillingCheckoutMethod,
  BillingProvider,
  PlanKey,
} from "@/types/billing";

const validProviders = new Set<BillingProvider>(["antom", "stripe"]);
const validPlans = new Set<PlanKey>(["weekly", "monthly"]);
const validMethods = new Set<BillingCheckoutMethod>(["alipay", "card"]);

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const provider = body.provider as BillingProvider;
    const planKey = body.planKey as PlanKey;
    const checkoutMethod = body.checkoutMethod as BillingCheckoutMethod;

    if (
      !validProviders.has(provider) ||
      !validPlans.has(planKey) ||
      !validMethods.has(checkoutMethod)
    ) {
      return NextResponse.json({ error: "支付参数无效" }, { status: 400 });
    }

    const order = await createBillingOrder({
      userId: user.id,
      provider,
      planKey,
      checkoutMethod,
      metadata: { email: user.email ?? null },
    });

    if (provider === "stripe") {
      const session = await createStripeCheckoutSession({
        userId: user.id,
        email: user.email,
        planKey,
        orderId: order.id,
      });

      await updateBillingOrder(order.id, {
        provider_order_id: session.id,
        checkout_url: session.url,
        metadata: {
          stripeSessionId: session.id,
        },
      });

      return NextResponse.json({
        orderId: order.id,
        provider,
        checkoutUrl: session.url,
      });
    }

    const antomOrder = await createAntomSubscription({
      userId: user.id,
      planKey,
      orderId: order.id,
    });

    await updateBillingOrder(order.id, {
      provider_order_id: antomOrder.providerOrderId,
      provider_subscription_id: antomOrder.providerSubscriptionId,
      checkout_url: antomOrder.checkoutUrl,
      metadata: antomOrder.raw,
    });

    return NextResponse.json({
      orderId: order.id,
      provider,
      checkoutUrl: antomOrder.checkoutUrl,
    });
  } catch (error) {
    console.error("[billing/checkout] unexpected error", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "创建支付订单失败",
      },
      { status: 500 },
    );
  }
}

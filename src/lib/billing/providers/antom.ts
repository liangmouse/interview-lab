import { randomUUID } from "node:crypto";
import type { PlanKey } from "@/types/billing";
import { getBillingBaseUrl } from "@/lib/billing/config";

export async function createAntomSubscription(params: {
  userId: string;
  planKey: PlanKey;
  orderId: string;
}) {
  const endpoint = process.env.ANTOM_SUBSCRIPTION_CREATE_URL;
  const clientId = process.env.ANTOM_CLIENT_ID;
  const clientSecret = process.env.ANTOM_CLIENT_SECRET;

  if (!endpoint || !clientId || !clientSecret) {
    throw new Error("Antom 支付参数未配置完整");
  }

  const baseUrl = getBillingBaseUrl();
  const payload = {
    orderId: params.orderId,
    subscriptionRequestId: randomUUID(),
    planKey: params.planKey,
    userId: params.userId,
    returnUrl: `${baseUrl}/dashboard/profile?billing=success`,
    cancelUrl: `${baseUrl}/dashboard/profile?billing=cancel`,
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": clientId,
      "X-Client-Secret": clientSecret,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Antom 创建订阅失败: ${errorText}`);
  }

  const data = await response.json();
  return {
    providerOrderId: data.orderId || payload.orderId,
    providerSubscriptionId: data.subscriptionId || null,
    checkoutUrl: data.checkoutUrl || data.redirectUrl || null,
    raw: data,
  };
}

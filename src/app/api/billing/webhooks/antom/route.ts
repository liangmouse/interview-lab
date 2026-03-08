import { NextRequest, NextResponse } from "next/server";
import { createPublicKey, verify } from "node:crypto";
import {
  markWebhookEventProcessed,
  storeWebhookEvent,
  syncEntitlementFromSubscription,
  updateBillingOrder,
  upsertBillingSubscription,
} from "@/lib/billing/admin";

function resolveAntomStatus(eventType: string) {
  if (eventType.includes("CANCEL")) return "canceled";
  if (eventType.includes("FAIL")) return "past_due";
  if (eventType.includes("SUCCESS") || eventType.includes("ACTIVE")) {
    return "active";
  }
  return "inactive";
}

function getAntomSignature(headers: Headers) {
  return (
    headers.get("signature") ||
    headers.get("x-antom-signature") ||
    headers.get("antom-signature")
  );
}

function verifyAntomWebhookSignature(request: NextRequest, body: string) {
  const signature = getAntomSignature(request.headers);
  const clientId =
    request.headers.get("client-id") || request.headers.get("x-client-id");
  const requestTime =
    request.headers.get("request-time") ||
    request.headers.get("x-request-time");
  const publicKey = process.env.ANTOM_WEBHOOK_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error("ANTOM_WEBHOOK_PUBLIC_KEY 未配置");
  }

  if (!signature || !clientId || !requestTime) {
    return false;
  }

  const signatureValue = signature.includes("signature=")
    ? signature
        .split(",")
        .map((item) => item.trim())
        .find((item) => item.startsWith("signature="))
        ?.slice("signature=".length)
    : signature;

  if (!signatureValue) {
    return false;
  }

  const signatureBuffer = Buffer.from(signatureValue, "base64");
  const signingContent = `${request.method} ${request.nextUrl.pathname}\n${clientId}.${requestTime}.${body}`;

  return verify(
    "RSA-SHA256",
    Buffer.from(signingContent, "utf8"),
    createPublicKey(publicKey),
    signatureBuffer,
  );
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!verifyAntomWebhookSignature(request, rawBody)) {
      return NextResponse.json({ error: "Antom 签名校验失败" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody) as Record<string, any>;
    const eventId =
      payload.notifyId || payload.notificationId || payload.eventId;
    const eventType = payload.eventType || payload.resultStatus || "UNKNOWN";

    if (!eventId) {
      return NextResponse.json({ error: "缺少 eventId" }, { status: 400 });
    }

    const stored = await storeWebhookEvent({
      provider: "antom",
      eventId,
      eventType,
      payload,
    });

    if (stored.duplicated) {
      return NextResponse.json({ received: true, duplicated: true });
    }

    const orderId = payload.orderId || payload.merchantOrderId;
    if (orderId) {
      await updateBillingOrder(orderId, {
        status: resolveAntomStatus(eventType),
        provider_order_id: payload.paymentRequestId || payload.orderId || null,
        provider_subscription_id:
          payload.subscriptionId || payload.agreementId || null,
        metadata: payload,
      });
    }

    const userId = payload.userId || payload.merchantUserId;
    const subscriptionId = payload.subscriptionId || payload.agreementId;
    if (userId && subscriptionId) {
      const saved = await upsertBillingSubscription({
        userId,
        provider: "antom",
        planKey: payload.planKey === "weekly" ? "weekly" : "monthly",
        providerSubscriptionId: subscriptionId,
        providerCustomerId: payload.customerId || payload.buyerId || null,
        status: resolveAntomStatus(eventType),
        currentPeriodStart: payload.currentPeriodStart || null,
        currentPeriodEnd: payload.currentPeriodEnd || null,
        cancelAtPeriodEnd: Boolean(payload.cancelAtPeriodEnd),
        metadata: payload,
      });

      await syncEntitlementFromSubscription({
        userId,
        subscriptionId: saved.id,
        status: saved.status,
        currentPeriodEnd: saved.current_period_end,
        cancelAtPeriodEnd: Boolean(payload.cancelAtPeriodEnd),
      });
    }

    await markWebhookEventProcessed(stored.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[billing/webhooks/antom] unexpected error", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Antom webhook 处理失败",
      },
      { status: 400 },
    );
  }
}

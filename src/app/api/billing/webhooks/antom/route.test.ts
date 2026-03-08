import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSign, generateKeyPairSync } from "node:crypto";

const {
  mockMarkWebhookEventProcessed,
  mockStoreWebhookEvent,
  mockSyncEntitlementFromSubscription,
  mockUpdateBillingOrder,
  mockUpsertBillingSubscription,
} = vi.hoisted(() => {
  return {
    mockMarkWebhookEventProcessed: vi.fn(),
    mockStoreWebhookEvent: vi.fn(),
    mockSyncEntitlementFromSubscription: vi.fn(),
    mockUpdateBillingOrder: vi.fn(),
    mockUpsertBillingSubscription: vi.fn(),
  };
});

vi.mock("@/lib/billing/admin", () => ({
  markWebhookEventProcessed: mockMarkWebhookEventProcessed,
  storeWebhookEvent: mockStoreWebhookEvent,
  syncEntitlementFromSubscription: mockSyncEntitlementFromSubscription,
  updateBillingOrder: mockUpdateBillingOrder,
  upsertBillingSubscription: mockUpsertBillingSubscription,
}));

import { POST } from "./route";

describe("Antom Webhook API", () => {
  const previousPublicKey = process.env.ANTOM_WEBHOOK_PUBLIC_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreWebhookEvent.mockResolvedValue({ duplicated: false, id: "event-1" });
    mockUpsertBillingSubscription.mockResolvedValue({
      id: "sub_1",
      status: "active",
      current_period_end: "2099-01-01T00:00:00.000Z",
    });
  });

  it("rejects requests with invalid signature", async () => {
    const { publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    process.env.ANTOM_WEBHOOK_PUBLIC_KEY = publicKey.export({
      type: "spki",
      format: "pem",
    }) as string;

    const request = new NextRequest(
      "http://localhost:3000/api/billing/webhooks/antom",
      {
        method: "POST",
        body: JSON.stringify({ eventId: "evt_1", eventType: "SUCCESS" }),
        headers: {
          "content-type": "application/json",
        },
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Antom 签名校验失败");
    expect(mockStoreWebhookEvent).not.toHaveBeenCalled();
  });

  it("accepts a correctly signed request", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    process.env.ANTOM_WEBHOOK_PUBLIC_KEY = publicKey.export({
      type: "spki",
      format: "pem",
    }) as string;

    const payload = JSON.stringify({
      eventId: "evt_1",
      eventType: "PAYMENT_SUCCESS",
      userId: "user-1",
      subscriptionId: "sub-ext-1",
      currentPeriodEnd: "2099-01-01T00:00:00.000Z",
    });
    const clientId = "client-1";
    const requestTime = "1710000000";
    const signingContent =
      `POST /api/billing/webhooks/antom\n${clientId}.${requestTime}.${payload}`;
    const signer = createSign("RSA-SHA256");
    signer.update(signingContent);
    signer.end();
    const signature = signer.sign(privateKey).toString("base64");

    const request = new NextRequest(
      "http://localhost:3000/api/billing/webhooks/antom",
      {
        method: "POST",
        body: payload,
        headers: {
          "content-type": "application/json",
          "client-id": clientId,
          "request-time": requestTime,
          signature,
        },
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mockStoreWebhookEvent).toHaveBeenCalled();
    expect(mockSyncEntitlementFromSubscription).toHaveBeenCalled();
  });

  afterAll(() => {
    process.env.ANTOM_WEBHOOK_PUBLIC_KEY = previousPublicKey;
  });
});

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockConstructEvent } = vi.hoisted(() => {
  const mockConstructEvent = vi.fn();
  return { mockConstructEvent };
});

vi.mock("@/lib/billing/providers/stripe", () => ({
  getStripeClient: () => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  }),
}));

const { mockStoreWebhookEvent, mockMarkWebhookEventProcessed } = vi.hoisted(() => {
  return {
    mockStoreWebhookEvent: vi.fn(),
    mockMarkWebhookEventProcessed: vi.fn(),
  };
});

vi.mock("@/lib/billing/admin", () => ({
  markWebhookEventProcessed: mockMarkWebhookEventProcessed,
  storeWebhookEvent: mockStoreWebhookEvent,
  syncEntitlementFromSubscription: vi.fn(),
  updateBillingOrder: vi.fn(),
  upsertBillingSubscription: vi.fn(),
}));

import { POST } from "./route";

describe("Stripe Webhook API", () => {
  const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mockStoreWebhookEvent.mockResolvedValue({ duplicated: false, id: "event-1" });
  });

  it("rejects unsigned webhook payloads", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/billing/webhooks/stripe",
      {
        method: "POST",
        body: JSON.stringify({ id: "evt_1", type: "test.event" }),
        headers: {
          "content-type": "application/json",
        },
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("缺少 stripe-signature");
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  afterAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
  });
});

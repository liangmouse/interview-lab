import { describe, expect, it } from "vitest";
import { resolveUserAccessForUserId } from "./access";

describe("resolveUserAccessForUserId", () => {
  it("returns free access with remaining trial count", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                user_id: "user-1",
                trial_total: 3,
                trial_used: 1,
                current_tier: "free",
                premium_expires_at: null,
                cancel_at_period_end: false,
                active_subscription_id: null,
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    const access = await resolveUserAccessForUserId("user-1", supabase as any);

    expect(access.tier).toBe("free");
    expect(access.trialRemaining).toBe(2);
    expect(access.canUsePersonalization).toBe(false);
  });

  it("falls back to free when premium is expired", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                user_id: "user-1",
                trial_total: 3,
                trial_used: 3,
                current_tier: "premium",
                premium_expires_at: "2020-01-01T00:00:00.000Z",
                cancel_at_period_end: true,
                active_subscription_id: "sub_123",
              },
              error: null,
            }),
          }),
        }),
      }),
    };

    const access = await resolveUserAccessForUserId("user-1", supabase as any);

    expect(access.tier).toBe("free");
    expect(access.subscriptionStatus).toBe("expired");
    expect(access.currentPeriodEnd).toBe("2020-01-01T00:00:00.000Z");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAuthGetUser,
  mockProfileSingle,
  mockInsertSingle,
  mockInterviewInsert,
  mockRpc,
  mockCreateClient,
} = vi.hoisted(() => {
  const mockAuthGetUser = vi.fn();
  const mockProfileSingle = vi.fn();
  const mockInsertSingle = vi.fn();
  const mockRpc = vi.fn();
  const mockInterviewInsert = vi.fn();

  const mockCreateClient = vi.fn(async () => ({
    auth: {
      getUser: mockAuthGetUser,
    },
    from: vi.fn((table: string) => {
      if (table === "user_profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockProfileSingle,
            })),
          })),
        };
      }

      if (table === "interviews") {
        return {
          insert: mockInterviewInsert.mockImplementation(() => ({
            select: vi.fn(() => ({
              single: mockInsertSingle,
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: mockRpc,
  }));

  return {
    mockAuthGetUser,
    mockProfileSingle,
    mockInsertSingle,
    mockRpc,
    mockCreateClient,
    mockInterviewInsert,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/billing/access", () => ({
  resolveUserAccessForUserId: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createInterview } from "./create-interview";
import { resolveUserAccessForUserId } from "@/lib/billing/access";

describe("createInterview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mockProfileSingle.mockResolvedValue({
      data: { id: "profile-1" },
      error: null,
    });
    mockInsertSingle.mockResolvedValue({
      data: { id: "interview-1" },
      error: null,
    });
    mockRpc.mockResolvedValue({
      data: { allowed: true, trialRemaining: 2 },
      error: null,
    });
    vi.mocked(resolveUserAccessForUserId).mockResolvedValue({
      tier: "free",
      trialTotal: 3,
      trialUsed: 0,
      trialRemaining: 3,
      canUsePersonalization: false,
      canViewFullReport: false,
      subscriptionStatus: "inactive",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      activeSubscriptionId: null,
    });
  });

  it("consumes a free trial before creating a generic interview", async () => {
    const result = await createInterview({
      topic: "frontend",
      difficulty: "beginner",
      duration: 10,
    });

    expect(result).toEqual({ interviewId: "interview-1" });
    expect(mockRpc).toHaveBeenCalledWith("consume_trial_if_available", {
      p_user_id: "user-1",
    });
  });

  it("blocks personalization for free users", async () => {
    const result = await createInterview({
      topic: "frontend",
      difficulty: "beginner",
      duration: 10,
      personalizationMode: "resume",
    });

    expect(result).toEqual({
      error: "简历/JD 定制面试需要会员权限，请先升级",
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("does not consume free trial for premium users", async () => {
    vi.mocked(resolveUserAccessForUserId).mockResolvedValue({
      tier: "premium",
      trialTotal: 3,
      trialUsed: 3,
      trialRemaining: 0,
      canUsePersonalization: true,
      canViewFullReport: true,
      subscriptionStatus: "active",
      currentPeriodEnd: "2099-01-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      activeSubscriptionId: "sub_1",
    });

    const result = await createInterview({
      topic: "frontend",
      difficulty: "advanced",
      duration: 25,
      personalizationMode: "resume",
    });

    expect(result).toEqual({ interviewId: "interview-1" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("stores coding interviews with the coding variant in type", async () => {
    await createInterview({
      topic: "fullstack",
      difficulty: "advanced",
      duration: 60,
      variant: "coding",
    });

    expect(mockInterviewInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        type: "fullstack:advanced:coding",
        duration: "60",
      }),
    ]);
  });

  it("normalizes custom topics before storing interview type", async () => {
    await createInterview({
      topic: "产品经理：增长方向",
      difficulty: "intermediate",
      duration: 25,
    });

    expect(mockInterviewInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        type: "产品经理 增长方向:intermediate",
        duration: "25",
      }),
    ]);
  });
});

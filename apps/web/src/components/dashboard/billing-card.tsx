"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  BillingCheckoutMethod,
  BillingProvider,
  UserAccessState,
} from "@/types/billing";

interface BillingAccessResponse {
  access: UserAccessState;
  plans: Array<{
    key: "weekly" | "monthly";
    title: string;
    description: string;
    intervalLabel: string;
    priceLabel: string;
    recommended?: boolean;
  }>;
}

interface BillingCardProps {
  compact?: boolean;
}

export function BillingCard({ compact = false }: BillingCardProps) {
  const [data, setData] = useState<BillingAccessResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const loadAccess = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/billing/access", {
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const nextData = (await response.json()) as BillingAccessResponse;
      setData(nextData);
    } catch (error) {
      console.error("[BillingCard] failed to load access", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  const handleCheckout = useCallback(
    async (
      planKey: "weekly" | "monthly",
      provider: BillingProvider,
      checkoutMethod: BillingCheckoutMethod,
    ) => {
      const nextPendingKey = `${planKey}-${provider}-${checkoutMethod}`;
      setPendingKey(nextPendingKey);
      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planKey,
            provider,
            checkoutMethod,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "创建支付订单失败");
        }

        if (result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        }
      } catch (error) {
        alert(error instanceof Error ? error.message : "创建支付订单失败");
      } finally {
        setPendingKey(null);
      }
    },
    [],
  );

  const handleCancel = useCallback(async () => {
    setPendingKey("cancel");
    try {
      const response = await fetch("/api/billing/subscription/cancel", {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "取消续费失败");
      }
      await loadAccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : "取消续费失败");
    } finally {
      setPendingKey(null);
    }
  }, [loadAccess]);

  const access = data?.access;

  return (
    <section className="rounded-2xl border border-[#DCE5E0] bg-[linear-gradient(135deg,#0f3e2e,#175b43_55%,#e9f7ef_160%)] p-6 text-white shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-white/12 text-white hover:bg-white/12">
              <Crown className="mr-1 h-3.5 w-3.5" />
              会员中心
            </Badge>
            {access?.tier === "premium" && (
              <Badge className="bg-[#E8FAF1] text-[#0D8B58] hover:bg-[#E8FAF1]">
                已开通
              </Badge>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-semibold">
              {access?.tier === "premium"
                ? "会员权益已生效"
                : "免费用户可试用 3 次核心面试"}
            </h2>
            <p className="mt-1 text-sm text-white/80">
              {access
                ? access.tier === "premium"
                  ? `当前状态：${access.cancelAtPeriodEnd ? "已设置到期取消" : "自动续费中"}${access.currentPeriodEnd ? `，有效期至 ${new Date(access.currentPeriodEnd).toLocaleDateString("zh-CN")}` : ""}`
                  : `剩余试用 ${access.trialRemaining} 次，完整评估报告、JD/简历定制需要会员`
                : "加载会员信息中..."}
            </p>
          </div>
        </div>

        {access?.tier === "premium" && (
          <Button
            variant="secondary"
            onClick={handleCancel}
            disabled={pendingKey === "cancel"}
            className="bg-white text-[#0F3E2E] hover:bg-white/90"
          >
            {pendingKey === "cancel" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                处理中...
              </>
            ) : (
              "到期取消续费"
            )}
          </Button>
        )}
      </div>

      {!compact && (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {isLoading &&
            [1, 2].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/15 bg-white/8 p-5"
              >
                <div className="flex items-center gap-2 text-white/70">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载中...
                </div>
              </div>
            ))}

          {!isLoading &&
            data?.plans.map((plan) => (
              <div
                key={plan.key}
                className="rounded-2xl border border-white/15 bg-white/8 p-5 backdrop-blur-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold">{plan.title}</h3>
                      {plan.recommended && (
                        <Badge className="bg-[#E8FAF1] text-[#0D8B58] hover:bg-[#E8FAF1]">
                          推荐
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-white/75">
                      {plan.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold">{plan.priceLabel}</p>
                    <p className="text-xs text-white/70">
                      {plan.intervalLabel}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      void handleCheckout(plan.key, "antom", "alipay")
                    }
                    disabled={pendingKey === `${plan.key}-antom-alipay`}
                    className="bg-white text-[#0F3E2E] hover:bg-white/90"
                  >
                    {pendingKey === `${plan.key}-antom-alipay` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "支付宝开通"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      void handleCheckout(plan.key, "stripe", "card")
                    }
                    disabled={pendingKey === `${plan.key}-stripe-card`}
                    className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  >
                    {pendingKey === `${plan.key}-stripe-card` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "银行卡 / 国际卡"
                    )}
                  </Button>
                </div>
              </div>
            ))}
        </div>
      )}

      {compact && access && (
        <div className="mt-4 flex items-center gap-2 text-sm text-white/85">
          <Sparkles className="h-4 w-4" />
          {access.tier === "premium"
            ? "已解锁：无限模拟、完整报告、JD/简历定制"
            : `当前可用：基础通用面试，剩余 ${access.trialRemaining} 次`}
        </div>
      )}
    </section>
  );
}

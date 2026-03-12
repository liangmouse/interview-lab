"use client";

import { useTranslations } from "next-intl";
import { useUserStore } from "@/store/user";

export function WelcomeBanner() {
  const t = useTranslations("dashboard");
  const { userInfo } = useUserStore();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 sm:p-10">
      <div className="relative z-10 max-w-2xl space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          {t("welcome")},{" "}
          <span className="bg-gradient-to-r from-[#0F3E2E] to-[#10b981] bg-clip-text text-transparent">
            {userInfo?.nickname || "Friend"}
          </span>
        </h1>
        <p className="text-lg text-gray-500">{t("welcomeDesc")}</p>
      </div>
      <div className="absolute right-0 top-0 -mt-16 -mr-16 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 blur-3xl opacity-60 pointer-events-none" />
    </div>
  );
}

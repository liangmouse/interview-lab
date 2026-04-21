"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  buildAuthTabHref,
  normalizeAuthTab,
  type AuthTab,
} from "@/lib/auth-routing";
import { cn } from "@/lib/utils";

type AuthTabsProps = {
  initialTab: AuthTab;
  signInLabel: string;
  signUpLabel: string;
  signInContent: ReactNode;
  signUpContent: ReactNode;
};

export function AuthTabs({
  initialTab,
  signInLabel,
  signUpLabel,
  signInContent,
  signUpContent,
}: AuthTabsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = normalizeAuthTab(searchParams.get("tab") ?? initialTab);

  const handleTabChange = (nextTab: AuthTab) => {
    if (nextTab === currentTab) return;
    router.replace(buildAuthTabHref(pathname, nextTab, searchParams));
  };

  return (
    <>
      <div className="mb-6 grid grid-cols-2 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => handleTabChange("sign-in")}
          className={cn(
            "rounded-md px-4 py-2 text-center text-sm font-medium transition-colors",
            currentTab === "sign-in"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {signInLabel}
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("sign-up")}
          className={cn(
            "rounded-md px-4 py-2 text-center text-sm font-medium transition-colors",
            currentTab === "sign-up"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {signUpLabel}
        </button>
      </div>
      {currentTab === "sign-up" ? signUpContent : signInContent}
    </>
  );
}

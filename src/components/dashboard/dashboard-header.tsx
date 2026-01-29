"use client";

import { Bell, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";
import React from "react";
import { useTranslations } from "next-intl";
import { useUserStore } from "@/store/user";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  labelKey: string;
  href?: string;
}

interface DashboardHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  heading?: string;
  children?: React.ReactNode;
}

export function DashboardHeader({
  breadcrumbs,
  children,
}: DashboardHeaderProps) {
  const { userInfo } = useUserStore();
  const tDashboard = useTranslations("dashboard");
  const tProfile = useTranslations("profile");

  const defaultBreadcrumbs: BreadcrumbItem[] = [
    { labelKey: "home", href: "/" },
    { labelKey: "title", href: "/dashboard" },
  ];

  const items = breadcrumbs || defaultBreadcrumbs;

  // Translate label based on key prefix
  const translateLabel = (labelKey: string) => {
    if (labelKey.startsWith("profile.")) {
      return tProfile(labelKey.replace("profile.", ""));
    }
    return tDashboard(labelKey);
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/40 bg-background/80 px-6 backdrop-blur-md lg:px-8 transition-all">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <React.Fragment key={index}>
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            )}
            {item.href ? (
              <Link
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground",
                  index === items.length - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {translateLabel(item.labelKey)}
              </Link>
            ) : (
              <span
                className={cn(
                  index === items.length - 1
                    ? "font-medium text-foreground"
                    : "",
                )}
              >
                {translateLabel(item.labelKey)}
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
      <div className="flex items-center gap-4">
        {children}
        <div className="h-6 w-px bg-border/60" />
        <button className="group relative rounded-full p-2.5 text-muted-foreground transition-all hover:bg-accent hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background transition-transform group-hover:scale-110" />
        </button>
        <Avatar className="h-9 w-9 ring-2 ring-border/50 transition-shadow hover:ring-primary/20">
          <AvatarImage
            src={userInfo?.avatar_url || "/placeholder.svg?height=36&width=36"}
            alt={userInfo?.nickname || "User Avatar"}
          />
          <AvatarFallback>
            {userInfo?.nickname?.slice(0, 2).toUpperCase() || "ME"}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

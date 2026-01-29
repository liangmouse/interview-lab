"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, User, History, Settings } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

export function Sidebar() {
  const t = useTranslations("dashboard.sidebar");
  const pathname = usePathname();

  const navItems = [
    {
      title: t("dashboard"),
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: t("profile"),
      href: "/dashboard/profile",
      icon: User,
    },
    {
      title: t("history"),
      href: "/dashboard/history",
      icon: History,
    },
    {
      title: t("settings"),
      href: "/dashboard/settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="hidden w-64 flex-col border-r border-border/50 bg-background/95 backdrop-blur-sm lg:flex">
      <div className="flex h-16 items-center gap-3 px-6 border-b border-border/40">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Image
            src="/favicon.png"
            alt="Logo"
            width={24}
            height={24}
            className="h-5 w-5"
          />
        </div>
        <span className="text-lg font-bold tracking-tight text-foreground/90">
          {t("brand")}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-4.5 w-4.5",
                    isActive ? "text-primary" : "text-muted-foreground/70",
                  )}
                />
                {item.title}
              </Link>
            );
          })}
        </nav>

        <div className="rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 p-4 border border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <span className="text-xs font-bold text-primary">Pro</span>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                Upgrade Plan
              </p>
              <p className="text-[10px] text-muted-foreground">
                Unlock all features
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

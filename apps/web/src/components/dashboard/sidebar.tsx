"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useUserStore } from "@/store/user";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { sidebarGroups, isSidebarItemActive } from "./sidebar-config";

export function Sidebar() {
  const t = useTranslations("dashboard.sidebar");
  const pathname = usePathname();
  const { userInfo } = useUserStore();

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-border/50 bg-background/95 backdrop-blur-sm lg:flex">
      <Link
        href="/dashboard"
        className="flex h-16 items-center gap-3 border-b border-border/40 px-6 transition-colors hover:bg-muted/30"
      >
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
      </Link>

      <div className="flex-1 space-y-8 overflow-y-auto p-4">
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
        >
          <Avatar className="h-11 w-11 ring-2 ring-border/60">
            <AvatarImage
              src={
                userInfo?.avatar_url || "/placeholder.svg?height=44&width=44"
              }
              alt={userInfo?.nickname || t("accountLabel")}
            />
            <AvatarFallback>
              {userInfo?.nickname?.slice(0, 2).toUpperCase() || "ME"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">
              {userInfo?.nickname || t("accountLabel")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("accountPlanHint")}
            </p>
          </div>
        </Link>

        <nav className="space-y-7">
          {sidebarGroups.map((group) => (
            <section key={group.key} className="space-y-2.5">
              <p className="px-2 text-xs font-semibold tracking-wide text-muted-foreground/90">
                {t(group.titleKey)}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = isSidebarItemActive(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.key}
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
                          isActive
                            ? "text-primary"
                            : "text-muted-foreground/80",
                        )}
                      />
                      {t(item.titleKey)}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </div>
      <div className="border-t border-border/50 px-4 py-3">
        <Link
          href="/profile"
          className={cn(
            "mb-2 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
            isSidebarItemActive(pathname, "/profile")
              ? "bg-primary/10 text-primary shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <User
            className={cn(
              "h-4.5 w-4.5",
              isSidebarItemActive(pathname, "/profile")
                ? "text-primary"
                : "text-muted-foreground/80",
            )}
          />
          {t("profileCenter")}
        </Link>
      </div>
    </aside>
  );
}

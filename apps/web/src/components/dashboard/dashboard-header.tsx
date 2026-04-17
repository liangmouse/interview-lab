"use client";

import { Bell, ChevronRight, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link, useRouter } from "@/i18n/navigation";
import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useUserStore } from "@/store/user";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BreadcrumbItem {
  labelKey?: string;
  label?: string;
  href?: string;
}

interface DashboardHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  children?: React.ReactNode;
}

export function DashboardHeader({
  breadcrumbs,
  children,
}: DashboardHeaderProps) {
  const { userInfo, clearUserInfo } = useUserStore();
  const router = useRouter();
  const tDashboard = useTranslations("dashboard");
  const tProfile = useTranslations("profile");
  const tNav = useTranslations("nav");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  const defaultBreadcrumbs: BreadcrumbItem[] = [
    { labelKey: "home", href: "/dashboard" },
    { labelKey: "title" },
  ];

  const items = breadcrumbs || defaultBreadcrumbs;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({
        scope: "local",
      });
      if (error) {
        throw error;
      }
      clearUserInfo();
      setConfirmLogoutOpen(false);
      router.replace("/auth/sign-in");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
      toast.error(tNav("logoutError") || "退出登录失败，请重试");
      setIsLoggingOut(false);
    }
  };

  // Translate label based on key prefix
  const translateLabel = (item: BreadcrumbItem) => {
    if (item.label) {
      return item.label;
    }

    const labelKey = item.labelKey || "";
    if (labelKey.startsWith("profile.")) {
      return tProfile(labelKey.replace("profile.", ""));
    }
    if (labelKey.startsWith("dashboard.")) {
      return tDashboard(labelKey.replace("dashboard.", ""));
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
                {translateLabel(item)}
              </Link>
            ) : (
              <span
                className={cn(
                  index === items.length - 1
                    ? "font-medium text-foreground"
                    : "",
                )}
              >
                {translateLabel(item)}
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
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => setConfirmLogoutOpen(true)}
          disabled={isLoggingOut}
          aria-label={tNav("logout")}
        >
          <LogOut className="h-5 w-5" />
        </Button>
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
      <AlertDialog
        open={confirmLogoutOpen}
        onOpenChange={(open) => {
          if (!isLoggingOut) {
            setConfirmLogoutOpen(open);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认退出登录</AlertDialogTitle>
            <AlertDialogDescription>
              退出后将立即返回登录页。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoggingOut}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={isLoggingOut}
              onClick={(event) => {
                event.preventDefault();
                void handleLogout();
              }}
            >
              确认退出
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}

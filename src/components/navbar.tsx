"use client";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/language-switcher";
import Image from "next/image";

export function Navbar() {
  const t = useTranslations("nav");

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 xl:px-24">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 transition-opacity">
            <Image
              src="/favicon.png"
              alt="Logo"
              width={36}
              height={36}
              className="size-9 rounded-lg"
            />
            <span className="text-lg font-semibold tracking-tight text-foreground">
              {t("projectName")}
            </span>
          </div>

          {/* Navigation Links */}
          <div className="hidden items-center gap-8 md:flex">
            <Link
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("features")}
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("pricing")}
            </Link>
            <Link
              href="#about"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("about")}
            </Link>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              asChild
            >
              <Link href="/auth/sign-in">{t("login")}</Link>
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              asChild
            >
              <Link href="/auth/sign-in?tab=sign-up">{t("getStarted")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

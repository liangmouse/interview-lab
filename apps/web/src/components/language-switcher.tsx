"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import type { Locale } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("language");

  const toggleLocale = () => {
    // 当前仅支持中英两种
    const nextLocale: Locale = locale === "zh" ? "en" : "zh";
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLocale}
      className="flex items-center gap-2"
      title={t("switch")}
    >
      <Globe className="size-4" />
      <span className="text-sm font-medium">{t(locale)}</span>
    </Button>
  );
}

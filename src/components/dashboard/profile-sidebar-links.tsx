"use client";

import { FileSearch, FileText, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const links = [
  {
    key: "questioning",
    href: "/questioning",
    icon: Sparkles,
  },
  {
    key: "resumeReview",
    href: "/resume-review",
    icon: FileSearch,
  },
  {
    key: "interview",
    href: "/interview",
    icon: FileText,
  },
] as const;

export function ProfileSidebarLinks() {
  const t = useTranslations("profile.center.sidebar");

  return (
    <Card className="border-[#E5E5E5] bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-[#141414]">
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.key}
              asChild
              variant="outline"
              className="h-10 w-full justify-start border-[#E5E5E5] text-[#141414]"
            >
              <Link href={item.href}>
                <Icon className="mr-2 h-4 w-4 text-[#0F3E2E]" />
                {t(`${item.key}.label`)}
              </Link>
            </Button>
          );
        })}

        <p className="pt-1 text-xs leading-5 text-[#777777]">{t("hint")}</p>
      </CardContent>
    </Card>
  );
}

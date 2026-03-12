"use client";

import { useRouter } from "@/i18n/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Play } from "lucide-react";
import { useUserStore } from "@/store/user";
import { useTranslations } from "next-intl";

export function HeroSection() {
  const router = useRouter();
  const { userInfo } = useUserStore();
  const isLoggedIn = !!userInfo;
  const t = useTranslations("hero");

  const handleStartSimulation = () => {
    if (isLoggedIn) {
      router.push("/dashboard");
    } else {
      router.push("/auth/sign-in");
    }
  };

  const handleWatchDemo = () => {
    // TODO: Add demo video modal or navigation
    console.log("Watch demo clicked");
  };

  return (
    <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32">
      {/* Background subtle texture */}
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.4]" />

      {/* Background gradient effects */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 size-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-20 right-1/4 size-96 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8 xl:px-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
          {/* Text Content */}
          <div className="flex flex-col justify-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary w-fit shadow-sm">
              <Sparkles className="size-4" />
              <span>{t("badge")}</span>
            </div>

            <h1 className="mb-8 text-4xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
              {t("title")}
              <br className="hidden lg:block" />{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {t("titleHighlight")}
              </span>
            </h1>

            <p className="mb-10 max-w-lg text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {t("description")}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button
                size="lg"
                className="cursor-pointer rounded-full px-8 py-6 text-base shadow-xl shadow-primary/20 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-primary/30"
                onClick={handleStartSimulation}
              >
                {isLoggedIn ? t("enterDashboard") : t("startSimulation")}
                <ArrowRight className="ml-2 size-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="cursor-pointer rounded-full px-8 py-6 text-base border-border bg-background/50 backdrop-blur-sm hover:bg-muted transition-all hover:scale-105"
                onClick={handleWatchDemo}
              >
                <Play className="mr-2 size-4 fill-current" />
                {t("watchDemo")}
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-16 flex flex-wrap items-center gap-8 border-t border-border/50 pt-8">
              <div>
                <div className="text-3xl font-bold text-foreground tracking-tight">
                  10,000+
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  {t("stats.successStories")}
                </div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <div className="text-3xl font-bold text-foreground tracking-tight">
                  98%
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  {t("stats.satisfactionRate")}
                </div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <div className="text-3xl font-bold text-foreground tracking-tight">
                  24/7
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                  {t("stats.aiAvailability")}
                </div>
              </div>
            </div>
          </div>

          {/* Visual Element */}
          <div className="relative w-full flex items-center justify-center lg:justify-end">
            <div className="relative w-full max-w-lg lg:max-w-xl">
              {/* Main visual placeholder */}
              <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] border border-border/60 bg-gradient-to-br from-white to-secondary/20 p-4 shadow-2xl ring-1 ring-black/5">
                <div className="relative h-full w-full overflow-hidden rounded-2xl bg-background">
                  {/* Image with overlay for color tinting */}
                  <Image
                    src="/abstract-tech-ai-interview-dashboard-with-code-and.jpg"
                    alt="AI Interview Platform"
                    fill
                    className="object-cover grayscale-[20%] contrast-[1.1]"
                    priority
                  />
                  {/* Tint Overlay: Warm/Greenish tint to unify with theme */}
                  <div className="absolute inset-0 bg-primary/20 mix-blend-color" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent mix-blend-overlay" />
                </div>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-6 -right-6 rounded-2xl border border-border/50 bg-white/90 p-4 shadow-xl backdrop-blur-md animate-float-delayed z-10">
                <div className="flex items-center gap-3">
                  <div className="relative size-3">
                    <div className="absolute inset-0 rounded-full bg-accent animate-ping opacity-75" />
                    <div className="relative size-3 rounded-full bg-accent" />
                  </div>
                  <span className="text-sm font-semibold text-foreground/80">
                    AI Analyzing...
                  </span>
                </div>
              </div>

              <div className="absolute -bottom-8 -left-8 rounded-2xl border border-border/50 bg-white/90 p-5 shadow-xl backdrop-blur-md animate-float z-10 hidden sm:block">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <span>Match Score</span>
                    <span className="ml-auto font-bold text-primary">98%</span>
                  </div>
                  <div className="h-2 w-32 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full w-[98%] rounded-full bg-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

export function AuthArtwork() {
  const t = useTranslations("auth.artwork");

  const features = [t("feature1"), t("feature2"), t("feature3"), t("feature4")];

  return (
    <div className="relative w-full h-full bg-linear-to-br from-[#FDFCF8] to-[#F2F0E8] overflow-hidden">
      {/* Subtle geometric pattern overlay with fade mask */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          maskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
        }}
      >
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="warm-grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="#141414"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#warm-grid)" />
        </svg>
      </div>

      {/* Abstract decorative circles */}
      <div className="absolute top-1/4 right-1/4 w-64 h-64 border border-[#E5E5E5] rounded-full opacity-30" />
      <div className="absolute bottom-1/3 left-1/3 w-48 h-48 border border-[#E5E5E5] rounded-full opacity-20" />

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-12 text-center">
        <div className="max-w-lg space-y-10">
          {/* Icon with Deep Emerald accent */}
          <div className="relative mx-auto w-20 h-20">
            <Image
              src="/favicon.png"
              alt="Interview Lab"
              width={100}
              height={100}
              priority
            />
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h2 className="text-4xl font-light text-[#141414] tracking-tight">
              {t("title")}
            </h2>
            <p className="text-lg text-[#666666] leading-relaxed">
              {t("description")}
            </p>
          </div>

          {/* Feature list with Deep Emerald checkmarks */}
          <div className="grid gap-5 pt-4 place-items-center">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-3 text-left w-full max-w-sm"
              >
                <CheckCircle2
                  className="shrink-0 w-5 h-5 text-[#0F3E2E] mt-0.5"
                  strokeWidth={2}
                />
                <span className="text-[#141414] text-base">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Decorative corner accent - subtle emerald hint */}
      <div className="absolute top-0 right-0 w-32 h-32 border-r-2 border-t-2 border-[#0F3E2E]/10" />
      <div className="absolute bottom-0 left-0 w-32 h-32 border-l-2 border-b-2 border-[#0F3E2E]/10" />
    </div>
  );
}

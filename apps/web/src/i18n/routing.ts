import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // 支持的语言列表
  locales: ["zh", "en"],

  // 默认语言 - 中文
  defaultLocale: "zh",

  // 中文: /dashboard
  // 英文: /en/dashboard
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

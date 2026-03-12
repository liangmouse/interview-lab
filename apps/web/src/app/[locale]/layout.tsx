import type React from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import StoreInitializer from "@/components/store-initializer";
import { getCurrentUserProfile } from "@/lib/data/user";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as "zh" | "en")) {
    notFound();
  }

  // Providing all messages to the client side is the easiest way to get started
  const messages = await getMessages();

  // Get user profile for store initialization (handles refresh & SSR)
  const userProfile = await getCurrentUserProfile();

  return (
    <NextIntlClientProvider messages={messages}>
      <StoreInitializer userInfo={userProfile} />
      {children}
    </NextIntlClientProvider>
  );
}

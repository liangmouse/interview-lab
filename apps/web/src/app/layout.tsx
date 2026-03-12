import type React from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geist = localFont({
  src: "../../public/fonts/Geist/Geist-VariableFont_wght.ttf",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../../public/fonts/Geist_Mono/GeistMono-VariableFont_wght.ttf",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Interview Lab - Master Your Next Tech Interview",
  description:
    "AI-powered interview preparation platform. Resume parsing, mock interviews, and real-time code assessment to help you land your dream tech job.",
  icons: {
    icon: [
      {
        url: "/favicon.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicon.svg",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}

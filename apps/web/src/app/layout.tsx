import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import type { PropsWithChildren } from "react";

import { ServiceWorkerProvider } from "@/components/providers/service-worker-provider";
import { TelegramProvider } from "@/components/providers/telegram-provider";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Amir Care Mini App",
  description: "Семейный Telegram Mini App для родителей: кормления, сон, подгузники, температура и лекарства.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Amir Care",
  },
  applicationName: "Amir Care",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#090d12",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${mono.variable}`}>
        <TelegramProvider />
        <ServiceWorkerProvider />
        {children}
      </body>
    </html>
  );
}

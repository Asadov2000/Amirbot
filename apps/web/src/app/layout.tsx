import type { Metadata, Viewport } from "next";
import type { PropsWithChildren } from "react";

import { ServiceWorkerProvider } from "@/components/providers/service-worker-provider";
import { TelegramProvider } from "@/components/providers/telegram-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Amir Care Mini App",
  description:
    "Семейный Telegram Mini App для родителей: кормления, сон, подгузники, температура и лекарства.",
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
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090d12" },
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
  ],
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="ru">
      <body>
        <TelegramProvider />
        <ServiceWorkerProvider />
        {children}
      </body>
    </html>
  );
}

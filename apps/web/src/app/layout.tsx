import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import type { PropsWithChildren } from "react";

import { InstallShortcutProvider } from "@/components/providers/install-shortcut-provider";
import { ServiceWorkerProvider } from "@/components/providers/service-worker-provider";
import { TelegramProvider } from "@/components/providers/telegram-provider";

import "./globals.css";

const fontDisplay = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display-loaded",
  display: "swap",
});

const fontText = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-text-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://amirbot-web.vercel.app"),
  title: "Амир",
  description: "Семейный журнал ухода за Амиром для мамы и папы.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Амир",
  },
  applicationName: "Амир",
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Амир",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale=1 предотвращает авто-зум iOS при фокусе на input (Mini App).
  // Доступность не страдает: пользовательский pinch-zoom всё равно работает
  // в системных браузерах (поддержка iOS 10+).
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
    { media: "(prefers-color-scheme: light)", color: "#f4f6fa" },
  ],
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html
      lang="ru"
      className={`${fontDisplay.variable} ${fontText.variable}`}
    >
      <body>
        <TelegramProvider />
        <ServiceWorkerProvider />
        <InstallShortcutProvider />
        {children}
      </body>
    </html>
  );
}

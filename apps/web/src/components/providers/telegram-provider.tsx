"use client";

import { useEffect } from "react";
import {
  bindMiniAppCssVars,
  bindThemeParamsCssVars,
  bindViewportCssVars,
  expandViewport,
  init,
  miniApp,
  miniAppReady,
  mountMiniAppSync,
  mountThemeParamsSync,
  mountViewport,
  viewport,
} from "@telegram-apps/sdk";

type TelegramBrowserWindow = Window &
  typeof globalThis & {
    Telegram?: {
      WebApp?: {
        colorScheme?: "dark" | "light";
        ready?: () => void;
        expand?: () => void;
      };
    };
  };

function hasTelegramWebApp() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean((window as TelegramBrowserWindow).Telegram?.WebApp);
}

function mountTelegramComponents() {
  const webApp = typeof window !== "undefined" ? (window as TelegramBrowserWindow).Telegram?.WebApp : undefined;

  if (webApp?.colorScheme && !window.localStorage.getItem("amir.theme")) {
    document.documentElement.dataset.theme = webApp.colorScheme;
    document.documentElement.style.colorScheme = webApp.colorScheme;
  }

  webApp?.ready?.();
  webApp?.expand?.();

  if (mountMiniAppSync.isAvailable()) {
    mountMiniAppSync();
  }
  if (mountThemeParamsSync.isAvailable()) {
    mountThemeParamsSync();
  }
  if (mountViewport.isAvailable()) {
    void mountViewport();
  }
  if (bindMiniAppCssVars.isAvailable()) {
    bindMiniAppCssVars();
  }
  if (bindThemeParamsCssVars.isAvailable()) {
    bindThemeParamsCssVars();
  }
  if (bindViewportCssVars.isAvailable()) {
    bindViewportCssVars();
  }
  if (miniAppReady.isAvailable()) {
    miniAppReady();
  }
  if (expandViewport.isAvailable()) {
    expandViewport();
  }
}

export function TelegramProvider() {
  useEffect(() => {
    let cleanup = () => {};
    let retryId: number | undefined;
    let attempts = 0;
    let mounted = false;

    const start = () => {
      attempts += 1;
      if (mounted || !hasTelegramWebApp()) {
        if (!mounted && attempts < 12) {
          retryId = window.setTimeout(start, 250);
        }
        return;
      }

      try {
        cleanup = init();
        mountTelegramComponents();
        mounted = true;
      } catch (error) {
        cleanup();
        console.warn("Telegram Mini App init failed", error);
      }
    };

    start();

    return () => {
      if (retryId) {
        window.clearTimeout(retryId);
      }
      cleanup();
      try {
        miniApp.unmount();
        viewport.unmount();
      } catch {
        // noop
      }
    };
  }, []);

  return null;
}

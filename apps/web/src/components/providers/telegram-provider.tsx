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
      WebApp?: unknown;
    };
  };

function hasTelegramWebApp() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean((window as TelegramBrowserWindow).Telegram?.WebApp);
}

function mountTelegramComponents() {
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
    if (!hasTelegramWebApp()) {
      return;
    }

    let cleanup = () => {};

    try {
      cleanup = init();
      mountTelegramComponents();
    } catch {
      cleanup();
    }

    return () => {
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

"use client";

import { useEffect, useState } from "react";

export type ThemePreference = "dark" | "light";

const THEME_KEY = "amir.theme";

type TelegramThemeWindow = Window &
  typeof globalThis & {
    Telegram?: {
      WebApp?: {
        colorScheme?: "dark" | "light";
      };
    };
  };

function readTelegramTheme(): ThemePreference | null {
  if (typeof window === "undefined") {
    return null;
  }

  const colorScheme = (window as TelegramThemeWindow).Telegram?.WebApp?.colorScheme;
  return colorScheme === "light" ? "light" : colorScheme === "dark" ? "dark" : null;
}

function readStoredTheme(): ThemePreference | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedTheme = window.localStorage.getItem(THEME_KEY);
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : null;
}

function resolveInitialTheme(): ThemePreference {
  return readStoredTheme() ?? readTelegramTheme() ?? "dark";
}

function applyTheme(theme: ThemePreference): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const themeColor = theme === "dark" ? "#090d12" : "#f4f7fb";
  let metaThemeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!metaThemeColor) {
    metaThemeColor = document.createElement("meta");
    metaThemeColor.name = "theme-color";
    document.head.appendChild(metaThemeColor);
  }
  metaThemeColor.content = themeColor;
}

export function useThemePreference() {
  const [theme, setThemeState] = useState<ThemePreference>("dark");

  useEffect(() => {
    const initialTheme = resolveInitialTheme();
    setThemeState(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const setTheme = (nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
    applyTheme(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_KEY, nextTheme);
    }
  };

  return {
    theme,
    setTheme,
  };
}

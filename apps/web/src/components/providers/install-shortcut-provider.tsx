"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallMode = "native" | "ios";

const DISMISS_KEY = "amir-install-shortcut-dismissed-until";
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isStandaloneApp() {
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function isTelegramWebView() {
  const telegramWindow = window as Window & {
    Telegram?: { WebApp?: unknown };
  };

  return Boolean(telegramWindow.Telegram?.WebApp);
}

function isIosSafari() {
  const userAgent = navigator.userAgent;
  const isAppleMobile = /iPad|iPhone|iPod/.test(userAgent);
  const isModernIpad =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const isSafari =
    /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);

  return (isAppleMobile || isModernIpad) && isSafari;
}

function isDismissed() {
  try {
    const until = Number(window.localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

function dismissTemporarily() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
  } catch {
    // localStorage can be blocked in some embedded browsers.
  }
}

export function InstallShortcutProvider() {
  const [mode, setMode] = useState<InstallMode | null>(null);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(
    null,
  );
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (isStandaloneApp() || isTelegramWebView() || isDismissed()) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setMode("native");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (isIosSafari()) {
      setMode("ios");
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  useEffect(() => {
    const handleInstalled = () => {
      dismissTemporarily();
      setMode(null);
      setPromptEvent(null);
    };

    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!mode) {
    return null;
  }

  const close = () => {
    dismissTemporarily();
    setMode(null);
  };

  const install = async () => {
    if (!promptEvent) {
      return;
    }

    setIsInstalling(true);

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      if (choice.outcome === "accepted") {
        dismissTemporarily();
        setMode(null);
      }
    } finally {
      setIsInstalling(false);
      setPromptEvent(null);
    }
  };

  const title = mode === "ios" ? "Ярлык на iPhone" : "Установить ярлык";
  const copy =
    mode === "ios"
      ? "Откройте сайт в Safari: Поделиться → На экран «Домой»."
      : "Откроется как отдельное приложение без адресной строки.";

  return (
    <aside className="install-shortcut-card" aria-live="polite">
      <div className="install-shortcut-icon" aria-hidden="true">
        A
      </div>
      <div className="install-shortcut-content">
        <div className="install-shortcut-title">{title}</div>
        <div className="install-shortcut-copy">{copy}</div>
      </div>
      <div className="install-shortcut-actions">
        {mode === "native" ? (
          <button
            className="install-shortcut-primary"
            type="button"
            disabled={isInstalling}
            onClick={() => void install()}
          >
            {isInstalling ? "Ждём…" : "Установить"}
          </button>
        ) : (
          <button
            className="install-shortcut-primary"
            type="button"
            onClick={close}
          >
            Понятно
          </button>
        )}
        <button
          className="install-shortcut-dismiss"
          type="button"
          aria-label="Скрыть подсказку"
          onClick={close}
        >
          ×
        </button>
      </div>
    </aside>
  );
}

import { retrieveLaunchParams, retrieveRawInitData } from "@telegram-apps/sdk";

import type { ActorId } from "./types";

interface TelegramWebAppUser {
  id?: number;
  username?: string;
  first_name?: string;
}

interface TelegramWebApp {
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
  };
}

type TelegramWindow = Window &
  typeof globalThis & {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  };

export interface ClientActorContext {
  actor: ActorId;
  locked: boolean;
  source: "telegram" | "local";
  displayName: string;
  initData?: string;
  allowed: boolean;
  telegramUserId?: string;
}

const DAD_TELEGRAM_ID = "5328212518";
const MOM_TELEGRAM_ID = "775978948";

function actorFromUser(user?: TelegramWebAppUser): ActorId | null {
  const telegramUserId = user?.id ? String(user.id) : undefined;

  if (telegramUserId === DAD_TELEGRAM_ID) {
    return "dad";
  }

  if (telegramUserId === MOM_TELEGRAM_ID) {
    return "mom";
  }

  return null;
}

export function getTelegramInitData(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const webAppInitData = (window as TelegramWindow).Telegram?.WebApp?.initData;
  if (webAppInitData) {
    return webAppInitData;
  }

  try {
    return retrieveRawInitData() || undefined;
  } catch {
    return undefined;
  }
}

export function resolveTelegramActor(): ClientActorContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const webApp = (window as TelegramWindow).Telegram?.WebApp;
  let user = webApp?.initDataUnsafe?.user;
  let initData = webApp?.initData || getTelegramInitData();

  if (!user) {
    try {
      const launchParams = retrieveLaunchParams(true);
      user = launchParams.tgWebAppData?.user
        ? {
            id: launchParams.tgWebAppData.user.id,
            username: launchParams.tgWebAppData.user.username,
            first_name: launchParams.tgWebAppData.user.firstName,
          }
        : undefined;
      initData = initData || retrieveRawInitData() || undefined;
    } catch {
      // Fall back to the native Telegram.WebApp object below.
    }
  }
  const actor = actorFromUser(user);

  if (!user && !initData) {
    return null;
  }

  return {
    actor: actor ?? "mom",
    locked: true,
    source: "telegram",
    displayName:
      actor === "dad" ? "Папа" : actor === "mom" ? "Мама" : "Проверяю доступ",
    // Telegram Desktop can expose raw initData before initDataUnsafe.user.
    // In that case the server is the source of truth and will resolve the actor.
    allowed: Boolean(actor || initData),
    telegramUserId: user?.id ? String(user.id) : undefined,
    initData,
  };
}

export function buildTelegramHeaders(actor: ActorId): HeadersInit {
  const initData = getTelegramInitData();

  return {
    ...(initData ? { "X-Telegram-Init-Data": initData } : {}),
    "X-Amir-Actor": actor,
  };
}

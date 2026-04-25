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

const DAD_USERNAME = "yamob";
const MOM_USERNAME = "manizha_u";

function actorFromUser(user?: TelegramWebAppUser): ActorId | null {
  const username = user?.username?.trim().replace(/^@+/, "").toLowerCase();

  if (username === DAD_USERNAME) {
    return "dad";
  }

  if (username === MOM_USERNAME) {
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
    locked: Boolean(actor),
    source: "telegram",
    displayName:
      actor === "dad" ? "Папа" : actor === "mom" ? "Мама" : "Проверяю доступ",
    allowed: true,
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

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
  deniedReason?: string;
  telegramUserId?: string;
}

const DAD_TELEGRAM_ID = "5328212518";
const MOM_TELEGRAM_ID = "775978948";

function actorFromUser(user?: TelegramWebAppUser): ActorId | null {
  const telegramUserId = user?.id ? String(user.id) : "";

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

  return (window as TelegramWindow).Telegram?.WebApp?.initData || undefined;
}

export function resolveTelegramActor(): ClientActorContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const webApp = (window as TelegramWindow).Telegram?.WebApp;
  const user = webApp?.initDataUnsafe?.user;
  const actor = actorFromUser(user);

  if (!webApp || !user) {
    return null;
  }

  if (!actor) {
    return {
      actor: "mom",
      locked: true,
      source: "telegram",
      displayName: "Нет доступа",
      allowed: false,
      deniedReason: "Доступ открыт только маме и папе Амира.",
      telegramUserId: user.id ? String(user.id) : undefined,
      initData: webApp.initData || undefined,
    };
  }

  return {
    actor,
    locked: true,
    source: "telegram",
    displayName: actor === "dad" ? "Папа" : "Мама",
    allowed: true,
    telegramUserId: user.id ? String(user.id) : undefined,
    initData: webApp?.initData || undefined,
  };
}

export function buildTelegramHeaders(actor: ActorId): HeadersInit {
  const initData = getTelegramInitData();

  return {
    ...(initData ? { "X-Telegram-Init-Data": initData } : {}),
    "X-Amir-Actor": actor,
  };
}

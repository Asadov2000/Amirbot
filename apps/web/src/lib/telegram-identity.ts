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

  return {
    actor: actor ?? "mom",
    locked: Boolean(actor),
    source: "telegram",
    displayName:
      actor === "dad" ? "Папа" : actor === "mom" ? "Мама" : "Проверяю доступ",
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

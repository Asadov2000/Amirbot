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
}

const DAD_USERNAME = "yamob";
const MOM_USERNAME = "manizha_u";

function normalizeUsername(value?: string): string {
  return value?.trim().replace(/^@+/, "").toLowerCase() ?? "";
}

function actorFromUsername(username?: string): ActorId | null {
  const normalized = normalizeUsername(username);

  if (normalized === DAD_USERNAME) {
    return "dad";
  }

  if (normalized === MOM_USERNAME) {
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
  const actor = actorFromUsername(user?.username);

  if (!actor) {
    return null;
  }

  return {
    actor,
    locked: true,
    source: "telegram",
    displayName: actor === "dad" ? "Папа" : "Мама",
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

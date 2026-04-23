import { createHmac, timingSafeEqual } from "node:crypto";

import type { ActorId } from "../types";

interface TelegramInitDataUser {
  id?: number;
  username?: string;
  first_name?: string;
}

export interface RequestActor {
  actor: ActorId;
  telegramUserId?: string;
  username?: string;
}

const isProduction = process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
const MOM_USERNAME = normalizeUsername(process.env.DEFAULT_MOM_USERNAME ?? "manizha_u");
const DAD_USERNAME = normalizeUsername(process.env.DEFAULT_DAD_USERNAME ?? "yamob");
const MOM_TELEGRAM_ID = process.env.DEFAULT_MOM_TELEGRAM_ID;
const DAD_TELEGRAM_ID = process.env.DEFAULT_DAD_TELEGRAM_ID;

function normalizeUsername(value?: string): string {
  return value?.trim().replace(/^@+/, "").toLowerCase() ?? "";
}

function actorFromUser(user: TelegramInitDataUser): ActorId | null {
  const telegramUserId = user.id ? String(user.id) : undefined;

  if (telegramUserId && DAD_TELEGRAM_ID && telegramUserId === DAD_TELEGRAM_ID) {
    return "dad";
  }

  if (telegramUserId && MOM_TELEGRAM_ID && telegramUserId === MOM_TELEGRAM_ID) {
    return "mom";
  }

  const username = normalizeUsername(user.username);

  if (username === DAD_USERNAME) {
    return "dad";
  }

  if (username === MOM_USERNAME) {
    return "mom";
  }

  return null;
}

function verifyTelegramInitData(initData: string, botToken: string): URLSearchParams {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");

  if (!hash) {
    throw new Error("Telegram init data hash is missing");
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hash, "hex");

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Telegram init data hash is invalid");
  }

  return params;
}

function actorFromLocalFallback(request: Request): RequestActor | null {
  if (isProduction) {
    return null;
  }

  const actor = request.headers.get("x-amir-actor");

  if (actor === "dad" || actor === "mom") {
    return { actor };
  }

  return { actor: "mom" };
}

export function resolveRequestActor(request: Request): RequestActor {
  const initData = request.headers.get("x-telegram-init-data");
  const botToken = process.env.BOT_TOKEN;

  if (initData && botToken) {
    const params = verifyTelegramInitData(initData, botToken);
    const rawUser = params.get("user");

    if (!rawUser) {
      throw new Error("Telegram user is missing");
    }

    const user = JSON.parse(rawUser) as TelegramInitDataUser;
    const actor = actorFromUser(user);

    if (!actor) {
      throw new Error("Telegram user is not allowed for this family");
    }

    return {
      actor,
      telegramUserId: user.id ? String(user.id) : undefined,
      username: normalizeUsername(user.username),
    };
  }

  const fallback = actorFromLocalFallback(request);

  if (fallback) {
    return fallback;
  }

  throw new Error("Telegram authorization is required");
}

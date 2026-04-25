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

interface SessionPayload {
  actor: ActorId;
  exp: number;
  telegramUserId: string;
  username?: string;
}

export const TELEGRAM_SESSION_COOKIE = "amir_session";

const isProduction =
  process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
const MOM_TELEGRAM_ID = (
  process.env.DEFAULT_MOM_TELEGRAM_ID ?? (isProduction ? "" : "775978948")
).trim();
const DAD_TELEGRAM_ID = (
  process.env.DEFAULT_DAD_TELEGRAM_ID ?? (isProduction ? "" : "5328212518")
).trim();
const MOM_USERNAME = normalizeUsername(
  process.env.DEFAULT_MOM_USERNAME ?? "manizha_u",
);
const DAD_USERNAME = normalizeUsername(
  process.env.DEFAULT_DAD_USERNAME ?? "yamob",
);
const INIT_DATA_MAX_AGE_SECONDS = Number(
  process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS ?? 900,
);
export const TELEGRAM_SESSION_MAX_AGE_SECONDS = Number(
  process.env.TELEGRAM_SESSION_MAX_AGE_SECONDS ?? 60 * 60 * 24 * 30,
);

function normalizeUsername(value?: string): string {
  return value?.trim().replace(/^@+/, "").toLowerCase() ?? "";
}

function actorFromUser(user: TelegramInitDataUser): ActorId | null {
  if (!MOM_TELEGRAM_ID && !DAD_TELEGRAM_ID && !MOM_USERNAME && !DAD_USERNAME) {
    throw new Error("Telegram allowed users are not configured");
  }

  const telegramUserId = user.id ? String(user.id) : undefined;
  const username = normalizeUsername(user.username);

  if (
    (telegramUserId && telegramUserId === DAD_TELEGRAM_ID) ||
    (username && username === DAD_USERNAME)
  ) {
    return "dad";
  }

  if (
    (telegramUserId && telegramUserId === MOM_TELEGRAM_ID) ||
    (username && username === MOM_USERNAME)
  ) {
    return "mom";
  }

  return null;
}

function verifyTelegramInitData(
  initData: string,
  botToken: string,
): URLSearchParams {
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
  const expectedHash = createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hash, "hex");

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Telegram init data hash is invalid");
  }

  assertFreshTelegramAuth(params);
  return params;
}

function getBotToken() {
  return process.env.BOT_TOKEN?.trim();
}

function getSessionSecret() {
  const sessionSecret = process.env.APP_SESSION_SECRET?.trim();
  if (sessionSecret) {
    return sessionSecret;
  }

  return isProduction ? undefined : getBotToken();
}

function assertFreshTelegramAuth(params: URLSearchParams) {
  const rawAuthDate = params.get("auth_date");
  const authDateSeconds = rawAuthDate ? Number(rawAuthDate) : 0;

  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) {
    throw new Error("Telegram init data auth_date is missing");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (authDateSeconds > nowSeconds + 60) {
    throw new Error("Telegram init data auth_date is in the future");
  }

  if (nowSeconds - authDateSeconds > INIT_DATA_MAX_AGE_SECONDS) {
    throw new Error("Telegram init data expired");
  }
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signSessionPayload(payload: string, botToken: string) {
  return createHmac("sha256", botToken).update(payload).digest("base64url");
}

function parseCookies(cookieHeader: string | null) {
  const cookies = new Map<string, string>();

  for (const part of cookieHeader?.split(";") ?? []) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    cookies.set(
      part.slice(0, separatorIndex).trim(),
      part.slice(separatorIndex + 1).trim(),
    );
  }

  return cookies;
}

function parseSessionPayload(value: unknown): SessionPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const payload = value as Partial<SessionPayload>;
  if (
    (payload.actor !== "mom" && payload.actor !== "dad") ||
    typeof payload.telegramUserId !== "string" ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp)
  ) {
    return null;
  }

  return {
    actor: payload.actor,
    exp: payload.exp,
    telegramUserId: payload.telegramUserId,
    username:
      typeof payload.username === "string" ? payload.username : undefined,
  };
}

function resolveSessionActor(request: Request): RequestActor | null {
  const sessionSecret = getSessionSecret();
  const rawSession = parseCookies(request.headers.get("cookie")).get(
    TELEGRAM_SESSION_COOKIE,
  );

  if (!sessionSecret || !rawSession) {
    return null;
  }

  const [encodedPayload, signature] = rawSession.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signSessionPayload(encodedPayload, sessionSecret);
  const expected = Buffer.from(expectedSignature);
  const actual = Buffer.from(signature);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  let payload: SessionPayload | null;
  try {
    payload = parseSessionPayload(JSON.parse(base64UrlDecode(encodedPayload)));
  } catch {
    return null;
  }
  if (!payload || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  const actor = actorFromUser({ id: Number(payload.telegramUserId) });
  if (!actor || actor !== payload.actor) {
    return null;
  }

  return {
    actor,
    telegramUserId: payload.telegramUserId,
    username: normalizeUsername(payload.username),
  };
}

export function createTelegramSessionToken(actor: RequestActor) {
  const sessionSecret = getSessionSecret();
  if (!sessionSecret || !actor.telegramUserId) {
    return null;
  }

  const payload: SessionPayload = {
    actor: actor.actor,
    exp: Math.floor(Date.now() / 1000) + TELEGRAM_SESSION_MAX_AGE_SECONDS,
    telegramUserId: actor.telegramUserId,
    username: actor.username,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  return `${encodedPayload}.${signSessionPayload(encodedPayload, sessionSecret)}`;
}

export function shouldUseSecureSessionCookie() {
  return isProduction;
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
  const botToken = getBotToken();

  if (initData && botToken) {
    let params: URLSearchParams;

    try {
      params = verifyTelegramInitData(initData, botToken);
    } catch (error) {
      const sessionActor = resolveSessionActor(request);
      if (
        sessionActor &&
        error instanceof Error &&
        error.message.includes("expired")
      ) {
        return sessionActor;
      }

      throw error;
    }

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

  const sessionActor = resolveSessionActor(request);
  if (sessionActor) {
    return sessionActor;
  }

  const fallback = actorFromLocalFallback(request);

  if (fallback) {
    return fallback;
  }

  throw new Error("Telegram authorization is required");
}

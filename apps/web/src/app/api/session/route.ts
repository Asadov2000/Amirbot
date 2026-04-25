import { NextResponse } from "next/server";

import { safeApiError } from "@/lib/server/api-security";
import {
  createTelegramSessionToken,
  resolveRequestActor,
  shouldUseSecureSessionCookie,
  TELEGRAM_SESSION_COOKIE,
  TELEGRAM_SESSION_MAX_AGE_SECONDS,
} from "@/lib/server/telegram-auth";

export async function GET(request: Request) {
  try {
    const actor = resolveRequestActor(request);
    const response = NextResponse.json({
      ok: true,
      actor: actor.actor,
      displayName: actor.actor === "dad" ? "Папа" : "Мама",
    });

    const sessionToken = createTelegramSessionToken(actor);
    if (sessionToken) {
      response.cookies.set(TELEGRAM_SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        maxAge: TELEGRAM_SESSION_MAX_AGE_SECONDS,
        path: "/",
        sameSite: "lax",
        secure: shouldUseSecureSessionCookie(),
      });
    }

    return response;
  } catch (error) {
    return safeApiError(error, "Не удалось проверить доступ.");
  }
}

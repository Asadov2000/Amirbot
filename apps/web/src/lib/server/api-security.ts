import { NextResponse } from "next/server";

import { isTransientDbError } from "@amir/db";

export class ApiError extends Error {
  public constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly publicMessage = message,
  ) {
    super(message);
  }
}

const isProduction =
  process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
const MAX_JSON_BODY_BYTES = 16_384;

export function statusFromError(error: unknown) {
  if (error instanceof ApiError) {
    return error.statusCode;
  }

  if (isTransientDbError(error)) {
    return 503;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Breastfeeding")) {
    return 400;
  }
  return message.includes("Telegram") ? 403 : 500;
}

export function safeApiError(
  error: unknown,
  fallbackMessage = "Request failed",
) {
  const status = statusFromError(error);
  const message = error instanceof Error ? error.message : String(error);
  const publicMessage =
    error instanceof ApiError
      ? error.publicMessage
      : status === 403
        ? "Доступ запрещён. Откройте приложение через Telegram аккаунт мамы или папы."
        : status === 503
          ? "Сервер временно не готов. Данные не потеряны, повторите действие чуть позже."
          : isProduction
            ? fallbackMessage
            : message;

  return NextResponse.json(
    {
      ok: false,
      error: publicMessage,
    },
    { status },
  );
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(
      "Expected application/json request body",
      415,
      "Неверный формат запроса.",
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(
      "JSON request body is too large",
      413,
      "Запрос слишком большой.",
    );
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(
      "JSON request body is too large",
      413,
      "Запрос слишком большой.",
    );
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiError(
      "Malformed JSON request body",
      400,
      "Не удалось прочитать запрос.",
    );
  }
}

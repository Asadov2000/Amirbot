import { NextResponse } from "next/server";

import {
  createDashboardEvent,
  updateDashboardEvent,
} from "@/lib/server/dashboard";
import {
  ApiError,
  readJsonBody,
  safeApiError,
} from "@/lib/server/api-security";
import { validateEventDraft } from "@/lib/server/event-draft-validation";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { resolveRequestActor } from "@/lib/server/telegram-auth";

export async function POST(request: Request) {
  try {
    const actor = resolveRequestActor(request);
    assertRateLimit(
      `events:create:${actor.telegramUserId ?? actor.actor}`,
      45,
      60_000,
    );
    const payload = validateEventDraft(await readJsonBody<unknown>(request));
    const event = await createDashboardEvent(payload, actor.actor);

    return NextResponse.json({
      ok: true,
      event,
    });
  } catch (error) {
    return safeApiError(error, "Не удалось сохранить событие.");
  }
}

export async function PUT(request: Request) {
  try {
    const actor = resolveRequestActor(request);
    assertRateLimit(
      `events:update:${actor.telegramUserId ?? actor.actor}`,
      30,
      60_000,
    );
    const payload = await readJsonBody<{ id?: unknown; draft?: unknown }>(
      request,
    );
    if (typeof payload.id !== "string" || payload.id.trim().length === 0) {
      throw new ApiError("Event id is invalid", 400, "Некорректная запись.");
    }

    const draft = validateEventDraft(payload.draft);
    if (!draft.expectedRevision) {
      throw new ApiError(
        "Event expectedRevision is required",
        409,
        "Запись нужно обновить перед исправлением. Лента обновлена, повторите правку.",
      );
    }

    const event = await updateDashboardEvent(payload.id, draft, actor.actor);

    return NextResponse.json({
      ok: true,
      event,
    });
  } catch (error) {
    return safeApiError(error, "Не удалось обновить событие.");
  }
}

import { NextResponse } from "next/server";

import { deleteDashboardQuickItem } from "@/lib/server/dashboard";
import {
  ApiError,
  readJsonBody,
  safeApiError,
} from "@/lib/server/api-security";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { resolveRequestActor } from "@/lib/server/telegram-auth";
import type { QuickItemKind } from "@/lib/types";

export async function DELETE(request: Request) {
  try {
    const actor = resolveRequestActor(request);
    assertRateLimit(
      `quick-items:delete:${actor.telegramUserId ?? actor.actor}`,
      20,
      60_000,
    );
    const payload = await readJsonBody<{
      kind?: QuickItemKind;
      label?: string;
      clientRequestId?: string;
    }>(request);

    if (payload.kind !== "SOLID_FOOD" && payload.kind !== "MEDICATION") {
      throw new ApiError(
        "Unsupported quick item kind",
        400,
        "Некорректная быстрая кнопка.",
      );
    }

    const result = await deleteDashboardQuickItem(
      payload.kind,
      payload.label ?? "",
      actor.actor,
      typeof payload.clientRequestId === "string"
        ? payload.clientRequestId
        : undefined,
    );

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    return safeApiError(error, "Не удалось удалить быструю кнопку.");
  }
}

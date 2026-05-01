import { NextResponse } from "next/server";

import { getDashboardSyncState } from "@/lib/server/dashboard";
import { safeApiError } from "@/lib/server/api-security";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { resolveRequestActor } from "@/lib/server/telegram-auth";

export async function GET(request: Request) {
  try {
    const actor = resolveRequestActor(request);
    assertRateLimit(
      `sync:state:${actor.telegramUserId ?? actor.actor}`,
      120,
      60_000,
    );

    return NextResponse.json(await getDashboardSyncState());
  } catch (error) {
    return safeApiError(error, "Не удалось проверить синхронизацию.");
  }
}

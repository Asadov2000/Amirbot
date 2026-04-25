import { NextResponse } from "next/server";

import { getDashboardSnapshot } from "@/lib/server/dashboard";
import { getAiResponse } from "@/lib/server/ai";
import { safeApiError } from "@/lib/server/api-security";
import { resolveRequestActor } from "@/lib/server/telegram-auth";

export async function GET(request: Request) {
  try {
    resolveRequestActor(request);
    const snapshot = await getDashboardSnapshot();
    return NextResponse.json(getAiResponse(snapshot));
  } catch (error) {
    return safeApiError(error, "Подсказка временно недоступна.");
  }
}

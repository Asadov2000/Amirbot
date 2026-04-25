import { NextResponse } from "next/server";

import { getDashboardSnapshot } from "@/lib/server/dashboard";
import { safeApiError } from "@/lib/server/api-security";
import { resolveRequestActor } from "@/lib/server/telegram-auth";

export async function GET(request: Request) {
  try {
    resolveRequestActor(request);
    return NextResponse.json(await getDashboardSnapshot());
  } catch (error) {
    return safeApiError(error, "Не удалось загрузить данные семьи.");
  }
}

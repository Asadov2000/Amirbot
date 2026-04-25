import { NextResponse } from "next/server";

import { getDashboardSnapshot } from "@/lib/server/dashboard";
import { safeApiError } from "@/lib/server/api-security";
import { resolveRequestActor } from "@/lib/server/telegram-auth";

export async function GET(request: Request) {
  try {
    resolveRequestActor(request);
    const snapshot = await getDashboardSnapshot();

    return NextResponse.json({
      generatedAt: snapshot.generatedAt,
      summary: snapshot.summary,
      periodSummaries: snapshot.periodSummaries,
      overview: snapshot.overview,
      reminders: snapshot.reminders,
    });
  } catch (error) {
    return safeApiError(error, "Не удалось загрузить сводку.");
  }
}

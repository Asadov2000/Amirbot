import { NextResponse } from "next/server";

import { getDashboardSnapshot } from "@/lib/server/dashboard";
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
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Access denied",
      },
      { status: 403 },
    );
  }
}

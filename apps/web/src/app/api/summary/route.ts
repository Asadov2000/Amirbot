import { NextResponse } from "next/server";

import { getDashboardSnapshot } from "@/lib/server/dashboard";

export async function GET() {
  const snapshot = await getDashboardSnapshot();

  return NextResponse.json({
    generatedAt: snapshot.generatedAt,
    summary: snapshot.summary,
    periodSummaries: snapshot.periodSummaries,
    overview: snapshot.overview,
    reminders: snapshot.reminders,
  });
}

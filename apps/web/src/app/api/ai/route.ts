import { NextResponse } from "next/server";

import { getDashboardSnapshot } from "@/lib/server/dashboard";
import { getAiResponse } from "@/lib/server/ai";
import { resolveRequestActor } from "@/lib/server/telegram-auth";

export async function GET(request: Request) {
  try {
    resolveRequestActor(request);
    const snapshot = await getDashboardSnapshot();
    return NextResponse.json(getAiResponse(snapshot));
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

import { NextResponse } from "next/server";

import { createDashboardEvent, updateDashboardEvent } from "@/lib/server/dashboard";
import type { EventDraft } from "@/lib/types";

export async function POST(request: Request) {
  const payload = (await request.json()) as EventDraft;
  const event = await createDashboardEvent(payload);

  return NextResponse.json({
    ok: true,
    event,
  });
}

export async function PUT(request: Request) {
  const payload = (await request.json()) as { id: string; draft: EventDraft };
  const event = await updateDashboardEvent(payload.id, payload.draft);

  return NextResponse.json({
    ok: true,
    event,
  });
}

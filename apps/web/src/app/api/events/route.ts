import { NextResponse } from "next/server";

import { createDashboardEvent, updateDashboardEvent } from "@/lib/server/dashboard";
import { resolveRequestActor } from "@/lib/server/telegram-auth";
import type { EventDraft } from "@/lib/types";

function errorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Telegram") ? 403 : 500;
}

export async function POST(request: Request) {
  try {
    const actor = resolveRequestActor(request);
    const payload = (await request.json()) as EventDraft;
    const event = await createDashboardEvent(payload, actor.actor);

    return NextResponse.json({
      ok: true,
      event,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to create event",
      },
      { status: errorStatus(error) },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const actor = resolveRequestActor(request);
    const payload = (await request.json()) as { id: string; draft: EventDraft };
    const event = await updateDashboardEvent(payload.id, payload.draft, actor.actor);

    return NextResponse.json({
      ok: true,
      event,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to update event",
      },
      { status: errorStatus(error) },
    );
  }
}

import { NextResponse } from "next/server";

import { deleteDashboardQuickItem } from "@/lib/server/dashboard";
import { resolveRequestActor } from "@/lib/server/telegram-auth";
import type { QuickItemKind } from "@/lib/types";

export async function DELETE(request: Request) {
  try {
    const actor = resolveRequestActor(request);
    const payload = (await request.json()) as {
      kind?: QuickItemKind;
      label?: string;
    };

    if (payload.kind !== "SOLID_FOOD" && payload.kind !== "MEDICATION") {
      return NextResponse.json(
        { ok: false, error: "Unsupported quick item kind" },
        { status: 400 },
      );
    }

    const result = await deleteDashboardQuickItem(
      payload.kind,
      payload.label ?? "",
      actor.actor,
    );

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete quick item";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: message.includes("Telegram") ? 403 : 500 },
    );
  }
}

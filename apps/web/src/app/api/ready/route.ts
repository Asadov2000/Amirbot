import { NextResponse } from "next/server";

import { prisma, withDbRetry } from "@amir/db";

export async function GET() {
  try {
    await withDbRetry(() => prisma.$queryRaw`SELECT 1`, {
      attempts: 2,
      baseDelayMs: 100,
    });

    return NextResponse.json(
      {
        ok: true,
        service: "@amir/web",
        status: "ready",
        database: "ok",
        checkedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "@amir/web",
        status: "not_ready",
        database: "unavailable",
        checkedAt: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}

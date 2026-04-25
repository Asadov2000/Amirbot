import { NextResponse } from "next/server";

import { getDashboardSnapshot } from "@/lib/server/dashboard";
import { safeApiError } from "@/lib/server/api-security";
import { assertRateLimit } from "@/lib/server/rate-limit";
import {
  createSummaryCsv,
  createSummaryPdf,
  describeExportFilters,
  filterSnapshotForExport,
} from "@/lib/server/export";
import { resolveRequestActor } from "@/lib/server/telegram-auth";

export async function GET(request: Request) {
  try {
    const actor = resolveRequestActor(request);
    assertRateLimit(
      `exports:${actor.telegramUserId ?? actor.actor}`,
      12,
      60_000,
    );
    const snapshot = await getDashboardSnapshot();
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format");
    const filters = {
      period: searchParams.get("period"),
      kind: searchParams.get("kind"),
      actor: searchParams.get("actor"),
    };
    const exportSnapshot = filterSnapshotForExport(snapshot, filters);
    const filterLabel = describeExportFilters(filters);

    if (format === "csv") {
      return new NextResponse(createSummaryCsv(exportSnapshot, filterLabel), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="care-summary.csv"',
        },
      });
    }

    const pdf = await createSummaryPdf(exportSnapshot, filterLabel);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="care-summary.pdf"',
      },
    });
  } catch (error) {
    return safeApiError(error, "Не удалось подготовить экспорт.");
  }
}

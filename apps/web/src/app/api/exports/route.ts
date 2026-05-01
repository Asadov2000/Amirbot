import { NextResponse } from "next/server";

import { prisma, writeAuditLog } from "@amir/db";

import { getDashboardSnapshot } from "@/lib/server/dashboard";
import { ApiError, safeApiError } from "@/lib/server/api-security";
import { ensureDefaultFamilyContext } from "@/lib/server/family-context";
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
    if (format !== "pdf" && format !== "csv") {
      throw new ApiError(
        "Export format is invalid",
        400,
        "Некорректный формат экспорта.",
      );
    }
    const filters = {
      period: searchParams.get("period"),
      kind: searchParams.get("kind"),
      actor: searchParams.get("actor"),
    };
    const exportSnapshot = filterSnapshotForExport(snapshot, filters);
    const filterLabel = describeExportFilters(filters);
    const context = await ensureDefaultFamilyContext();
    await writeAuditLog(prisma, {
      familyId: context.familyId,
      childId: context.childId,
      actorUserId: context.actors[actor.actor].userId,
      action: "GENERATE",
      entityType: "Export",
      entityId: `${format ?? "pdf"}:${Date.now()}`,
      metadata: {
        format,
        filters,
      },
    });

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

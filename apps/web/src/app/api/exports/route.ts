import { NextResponse } from "next/server";

import { getDashboardSnapshot } from "@/lib/server/dashboard";
import { createSummaryCsv, createSummaryPdf, describeExportFilters, filterSnapshotForExport } from "@/lib/server/export";

export async function GET(request: Request) {
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
}

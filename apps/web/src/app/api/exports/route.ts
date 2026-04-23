import { NextResponse } from "next/server";

import { getDashboardSnapshot } from "@/lib/server/dashboard";
import { createSummaryCsv, createSummaryPdf } from "@/lib/server/export";

export async function GET(request: Request) {
  const snapshot = await getDashboardSnapshot();
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  if (format === "csv") {
    return new NextResponse(createSummaryCsv(snapshot), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="care-summary.csv"',
      },
    });
  }

  const pdf = await createSummaryPdf(snapshot);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="care-summary.pdf"',
    },
  });
}

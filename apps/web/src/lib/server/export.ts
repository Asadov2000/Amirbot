import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { formatDuration } from "../format";
import type { DashboardSnapshot } from "../types";

export async function createSummaryPdf(snapshot: DashboardSnapshot): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: 595,
    height: 842,
    color: rgb(0.05, 0.07, 0.11),
  });

  page.drawText(`Сводка по ребёнку: ${snapshot.child.name}`, {
    x: 40,
    y: 790,
    size: 24,
    font: bold,
    color: rgb(0.95, 0.98, 1),
  });

  page.drawText(`Дата: ${snapshot.summary.dateLabel}`, {
    x: 40,
    y: 760,
    size: 12,
    font,
    color: rgb(0.7, 0.78, 0.86),
  });

  const rows = [
    `Возраст: ${snapshot.child.ageLabel}`,
    `Кормлений: ${snapshot.summary.feedingsCount}`,
    `Общий сон: ${formatDuration(snapshot.summary.totalSleepMinutes)}`,
    `Средний интервал между кормлениями: ${formatDuration(snapshot.summary.averageFeedingIntervalMinutes)}`,
    `Подгузники: моча ${snapshot.summary.diaperWetCount}, кака ${snapshot.summary.diaperDirtyCount}`,
    `Температура: ${snapshot.summary.temperatureReadingsCount} замера`,
    `Лекарства: ${snapshot.summary.medicationsCount}`,
    `Последнее кормление: ${snapshot.overview.lastFeeding}`,
    `Сон сейчас: ${snapshot.overview.sleepStatus}`,
  ];

  let cursorY = 710;
  rows.forEach((row) => {
    page.drawText(row, {
      x: 40,
      y: cursorY,
      size: 14,
      font,
      color: rgb(0.88, 0.93, 0.97),
      maxWidth: 500,
    });
    cursorY -= 28;
  });

  page.drawText("Последние события", {
    x: 40,
    y: cursorY - 12,
    size: 18,
    font: bold,
    color: rgb(0.95, 0.98, 1),
  });

  cursorY -= 44;
  snapshot.events.slice(0, 8).forEach((event) => {
    page.drawText(`• ${event.summary} — ${new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.occurredAt))}`, {
      x: 48,
      y: cursorY,
      size: 12,
      font,
      color: rgb(0.82, 0.88, 0.94),
      maxWidth: 500,
    });
    cursorY -= 20;
  });

  return pdf.save();
}

export function createSummaryCsv(snapshot: DashboardSnapshot): string {
  const rows = [
    ["kind", "actor", "occurredAt", "summary"],
    ...snapshot.events.map((event) => [event.kind, event.actor, event.occurredAt, event.summary]),
  ];

  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
}

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { actorLabel, formatDuration } from "../format";
import type { CareEventRecord, DashboardSnapshot, PeriodSummary } from "../types";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 38;
const BODY_SIZE = 11;

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

function eventKindLabel(kind: CareEventRecord["kind"]): string {
  switch (kind) {
    case "FEEDING":
      return "Кормление";
    case "SOLID_FOOD":
      return "Прикорм";
    case "SLEEP":
      return "Сон";
    case "DIAPER":
      return "Подгузник";
    case "TEMPERATURE":
      return "Температура";
    case "MEDICATION":
      return "Лекарство";
    case "GROWTH":
      return "Вес и рост";
    case "NOTE":
    default:
      return "Заметка";
  }
}

function eventDetails(event: CareEventRecord): string {
  switch (event.kind) {
    case "FEEDING":
      return event.payload.mode === "BOTTLE"
        ? `${event.payload.volumeMl ?? ""} мл`
        : `${event.payload.durationMinutes ?? ""} мин`;
    case "SOLID_FOOD":
      return String(event.payload.food ?? event.payload.note ?? "");
    case "SLEEP":
      return event.payload.phase === "END" ? "Проснулся" : "Уснул";
    case "DIAPER":
      return event.payload.type === "DIRTY"
        ? "Покакал"
        : event.payload.type === "MIXED"
          ? "Пописал и покакал"
          : "Пописал";
    case "TEMPERATURE":
      return `${event.payload.temperatureC ?? ""} °C`;
    case "MEDICATION":
      return `${event.payload.medication ?? ""} ${event.payload.dose ?? ""}`.trim();
    case "GROWTH":
      return String(event.payload.note ?? event.summary);
    case "NOTE":
    default:
      return String(event.payload.note ?? "");
  }
}

function periodLine(summary: PeriodSummary): string {
  const diapers = summary.diaperWetCount + summary.diaperDirtyCount + (summary.diaperMixedCount ?? 0);
  return [
    summary.title,
    `кормлений ${summary.feedingsCount}`,
    `прикорм ${summary.solidFoodsCount ?? 0}`,
    `сон ${formatDuration(summary.totalSleepMinutes)}`,
    `подгузники ${diapers}`,
    `темп. ${summary.temperatureReadingsCount}`,
    `лекарства ${summary.medicationsCount}`,
    `рост/вес ${summary.growthReadingsCount ?? 0}`,
  ].join(" • ");
}

async function embedCyrillicFont(pdf: PDFDocument): Promise<PDFFont> {
  pdf.registerFontkit(fontkit);
  const fontPath = [
    join(process.cwd(), "public", "fonts", "geist-regular.ttf"),
    join(process.cwd(), "apps", "web", "public", "fonts", "geist-regular.ttf"),
  ].find((candidate) => existsSync(candidate));

  if (!fontPath) {
    throw new Error("PDF font file is missing");
  }

  return pdf.embedFont(readFileSync(fontPath), { subset: true });
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }

    if (line) {
      lines.push(line);
    }
    line = word;
  }

  if (line) {
    lines.push(line);
  }

  return lines.length ? lines : [""];
}

function drawWrappedText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  options: { size: number; maxWidth: number; color?: ReturnType<typeof rgb>; lineHeight?: number },
) {
  const lineHeight = options.lineHeight ?? options.size + 5;
  let cursorY = y;
  for (const line of wrapText(text, font, options.size, options.maxWidth)) {
    page.drawText(line, {
      x,
      y: cursorY,
      size: options.size,
      font,
      color: options.color ?? rgb(0.9, 0.95, 1),
    });
    cursorY -= lineHeight;
  }
  return cursorY;
}

export async function createSummaryPdf(snapshot: DashboardSnapshot): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await embedCyrillicFont(pdf);
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN;

  const resetPage = () => {
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: rgb(0.04, 0.06, 0.09) });
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 118, width: PAGE_WIDTH, height: 118, color: rgb(0.07, 0.11, 0.16) });
  };
  const nextPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - MARGIN;
    resetPage();
  };
  const ensureSpace = (height: number) => {
    if (cursorY - height < MARGIN) {
      nextPage();
    }
  };

  resetPage();
  page.drawText("Amir Care", { x: MARGIN, y: cursorY, size: 12, font, color: rgb(0.42, 0.91, 0.98) });
  cursorY -= 30;
  page.drawText(`Сводка по ребёнку: ${snapshot.child.name}`, {
    x: MARGIN,
    y: cursorY,
    size: 24,
    font,
    color: rgb(0.97, 0.99, 1),
  });
  cursorY -= 24;
  drawWrappedText(
    page,
    font,
    `Возраст: ${snapshot.child.ageLabel}. Экспорт сформирован: ${dateTimeFormatter.format(new Date(snapshot.generatedAt))}`,
    MARGIN,
    cursorY,
    { size: 12, maxWidth: PAGE_WIDTH - MARGIN * 2, color: rgb(0.74, 0.82, 0.9) },
  );

  cursorY = PAGE_HEIGHT - 150;
  page.drawText("Периоды", { x: MARGIN, y: cursorY, size: 17, font, color: rgb(0.97, 0.99, 1) });
  cursorY -= 22;
  for (const summary of snapshot.periodSummaries) {
    ensureSpace(26);
    cursorY = drawWrappedText(page, font, periodLine(summary), MARGIN, cursorY, {
      size: BODY_SIZE,
      maxWidth: PAGE_WIDTH - MARGIN * 2,
      color: rgb(0.86, 0.92, 0.98),
    });
    cursorY -= 4;
  }

  ensureSpace(132);
  cursorY -= 10;
  page.drawText("Текущий статус", { x: MARGIN, y: cursorY, size: 17, font, color: rgb(0.97, 0.99, 1) });
  cursorY -= 24;
  for (const row of [
    `Последнее кормление: ${snapshot.overview.lastFeeding}`,
    `Сон: ${snapshot.overview.sleepStatus}`,
    `Подгузник: ${snapshot.overview.diaperGap}`,
    `Температура: ${snapshot.overview.temperature}`,
    `Лекарства: ${snapshot.overview.medication}`,
  ]) {
    ensureSpace(22);
    cursorY = drawWrappedText(page, font, row, MARGIN, cursorY, {
      size: BODY_SIZE,
      maxWidth: PAGE_WIDTH - MARGIN * 2,
      color: rgb(0.82, 0.88, 0.94),
    });
  }

  ensureSpace(90);
  cursorY -= 12;
  page.drawText("События", { x: MARGIN, y: cursorY, size: 17, font, color: rgb(0.97, 0.99, 1) });
  cursorY -= 24;

  if (snapshot.events.length === 0) {
    drawWrappedText(page, font, "Записей пока нет. Экспорт содержит только пустую структуру сводки.", MARGIN, cursorY, {
      size: BODY_SIZE,
      maxWidth: PAGE_WIDTH - MARGIN * 2,
      color: rgb(0.74, 0.82, 0.9),
    });
  }

  for (const event of snapshot.events) {
    ensureSpace(50);
    const headline = `${dateTimeFormatter.format(new Date(event.occurredAt))} • ${actorLabel(event.actor)} • ${eventKindLabel(event.kind)}`;
    page.drawText(headline, { x: MARGIN, y: cursorY, size: 10, font, color: rgb(0.42, 0.91, 0.98) });
    cursorY -= 16;
    cursorY = drawWrappedText(page, font, `${event.summary}${eventDetails(event) ? ` (${eventDetails(event)})` : ""}`, MARGIN, cursorY, {
      size: BODY_SIZE,
      maxWidth: PAGE_WIDTH - MARGIN * 2,
      color: rgb(0.9, 0.95, 1),
    });
    cursorY -= 8;
  }

  return pdf.save();
}

function csvEscape(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function createSummaryCsv(snapshot: DashboardSnapshot): string {
  const rows: unknown[][] = [
    ["Раздел", "Показатель", "Значение"],
    ["Ребёнок", "Имя", snapshot.child.name],
    ["Ребёнок", "Возраст", snapshot.child.ageLabel],
    ["Экспорт", "Сформирован", dateTimeFormatter.format(new Date(snapshot.generatedAt))],
    [],
    ["Период", "Сводка", "Значение"],
    ...snapshot.periodSummaries.map((summary) => [summary.title, "Статистика", periodLine(summary)]),
    [],
    ["Время", "Категория", "Родитель", "Описание", "Детали", "Источник"],
    ...snapshot.events.map((event) => [
      dateTimeFormatter.format(new Date(event.occurredAt)),
      eventKindLabel(event.kind),
      actorLabel(event.actor),
      event.summary,
      eventDetails(event),
      event.source === "local" ? "локально" : "сервер",
    ]),
  ];

  return `\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}`;
}

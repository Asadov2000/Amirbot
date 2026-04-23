import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, StandardFonts } from "pdf-lib";
import type { Job } from "bullmq";

import type { WorkerConfig } from "../config.js";
import type { ExportBundle, ExportJobPayload } from "../domain/jobs.js";
import type { Logger } from "../lib/logger.js";
import type { CareBackendPort } from "../ports/care-backend.port.js";

export class ExportGeneratorService {
  public constructor(
    private readonly config: Pick<WorkerConfig, "exportOutputDirectory">,
    private readonly backend: CareBackendPort,
    private readonly logger: Logger
  ) {}

  public async process(job: Job<ExportJobPayload>): Promise<string> {
    const bundle =
      (await this.backend.loadExportBundle(job.data)) ?? buildFallbackExportBundle(job.data);
    const outputDirectory = path.resolve(this.config.exportOutputDirectory);
    const filePath = path.join(outputDirectory, `${job.data.exportJobId}.${job.data.format}`);

    await mkdir(outputDirectory, { recursive: true });

    try {
      if (job.data.format === "csv") {
        const csv = generateCsv(bundle);
        await writeFile(filePath, csv, "utf8");
      } else {
        const pdf = await generatePdf(bundle);
        await writeFile(filePath, pdf);
      }

      await this.backend.completeExportJob({
        exportJobId: job.data.exportJobId,
        status: "completed",
        format: job.data.format,
        filePath,
        completedAt: new Date()
      });

      this.logger.info("Export job completed", {
        exportJobId: job.data.exportJobId,
        filePath
      });

      return filePath;
    } catch (error) {
      await this.backend.completeExportJob({
        exportJobId: job.data.exportJobId,
        status: "failed",
        format: job.data.format,
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }
}

function buildFallbackExportBundle(payload: ExportJobPayload): ExportBundle {
  return {
    exportJobId: payload.exportJobId,
    title: "Экспорт журнала ухода",
    periodLabel: `${payload.fromDate} — ${payload.toDate}`,
    generatedAt: new Date().toISOString(),
    overview: [
      {
        label: "Статус",
        value: "Реальные данные будут доступны после подключения packages/db"
      }
    ],
    sections: []
  };
}

function generateCsv(bundle: ExportBundle): string {
  const chunks: string[] = [];

  chunks.push(`"${escapeCsv(bundle.title)}"`);
  chunks.push(`"Период","${escapeCsv(bundle.periodLabel)}"`);
  chunks.push(`"Сформировано","${escapeCsv(bundle.generatedAt)}"`);

  for (const item of bundle.overview) {
    chunks.push(`"${escapeCsv(item.label)}","${escapeCsv(item.value)}"`);
  }

  for (const section of bundle.sections) {
    chunks.push("");
    chunks.push(`"${escapeCsv(section.title)}"`);

    const headers = Array.from(new Set(section.rows.flatMap((row) => Object.keys(row))));

    if (!headers.length) {
      continue;
    }

    chunks.push(headers.map((header) => `"${escapeCsv(header)}"`).join(","));

    for (const row of section.rows) {
      chunks.push(
        headers
          .map((header) => `"${escapeCsv(stringifyCsvValue(row[header] ?? ""))}"`)
          .join(",")
      );
    }
  }

  return chunks.join("\n");
}

async function generatePdf(bundle: ExportBundle): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([595, 842]);
  const marginLeft = 48;
  const marginTop = 800;
  const lineHeight = 16;
  let cursorY = marginTop;

  const writeLine = (text: string, size = 11): void => {
    const lines = wrapText(text, 90);

    for (const line of lines) {
      if (cursorY < 60) {
        page = pdf.addPage([595, 842]);
        cursorY = marginTop;
      }

      page.drawText(line, {
        x: marginLeft,
        y: cursorY,
        size,
        font
      });

      cursorY -= lineHeight;
    }
  };

  writeLine(bundle.title, 16);
  cursorY -= 8;
  writeLine(`Период: ${bundle.periodLabel}`);
  writeLine(`Сформировано: ${bundle.generatedAt}`);

  if (bundle.childName) {
    writeLine(`Ребёнок: ${bundle.childName}`);
  }

  if (bundle.familyName) {
    writeLine(`Семья: ${bundle.familyName}`);
  }

  cursorY -= 8;

  for (const item of bundle.overview) {
    writeLine(`${item.label}: ${item.value}`);
  }

  for (const section of bundle.sections) {
    cursorY -= 10;
    writeLine(section.title, 13);

    if (!section.rows.length) {
      writeLine("Нет строк для экспорта");
      continue;
    }

    for (const row of section.rows) {
      const rowText = Object.entries(row)
        .map(([key, value]) => `${key}: ${stringifyCsvValue(value)}`)
        .join(" | ");

      writeLine(rowText);
    }
  }

  return pdf.save();
}

function wrapText(value: string, maxLineLength: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length <= maxLineLength) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length ? lines : [""];
}

function stringifyCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
}

function escapeCsv(value: string): string {
  return value.replaceAll('"', '""');
}

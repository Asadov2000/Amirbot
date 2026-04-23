import type {
  CareEventType,
  DiaperKind,
  ExportFormat,
  ReminderType
} from "./enums.js";
import type { CareEventDto, DailySummaryDto } from "./types.js";

const eventTypeLabels: Record<CareEventType, string> = {
  BREASTFEEDING: "Грудное кормление",
  BOTTLE_FEEDING: "Бутылочка",
  SLEEP: "Сон",
  DIAPER: "Подгузник",
  TEMPERATURE: "Температура",
  MEDICATION: "Лекарство",
  NOTE: "Заметка"
};

const reminderTypeLabels: Record<ReminderType, string> = {
  FEEDING: "Кормление",
  SLEEP: "Сон",
  DIAPER: "Подгузник",
  MEDICATION: "Лекарство",
  TEMPERATURE: "Температура",
  CUSTOM: "Напоминание"
};

const diaperKindLabels: Record<DiaperKind, string> = {
  WET: "Мокрый",
  DIRTY: "Кака",
  MIXED: "Смешанный",
  DRY_CHECK: "Проверка"
};

const exportFormatLabels: Record<ExportFormat, string> = {
  PDF: "PDF",
  CSV: "CSV"
};

const dateCache = new Map<string, Intl.DateTimeFormat>();
const dateTimeCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(timeZone: string) {
  const cacheKey = `date:${timeZone}`;
  const cached = dateCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  dateCache.set(cacheKey, formatter);

  return formatter;
}

function getDateTimeFormatter(timeZone: string) {
  const cacheKey = `datetime:${timeZone}`;
  const cached = dateTimeCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  dateTimeCache.set(cacheKey, formatter);

  return formatter;
}

function normalizeDate(date: Date | string) {
  const normalized = date instanceof Date ? new Date(date.getTime()) : new Date(date);

  if (Number.isNaN(normalized.getTime())) {
    throw new Error("Не удалось преобразовать значение к дате");
  }

  return normalized;
}

function getDatePart(date: Date, timeZone: string, part: Intl.DateTimeFormatPartTypes) {
  const match = getDateFormatter(timeZone)
    .formatToParts(date)
    .find((item) => item.type === part);

  if (!match) {
    throw new Error(`Не найден part=${part}`);
  }

  return match.value;
}

function getDateTimeParts(date: Date, timeZone: string) {
  return Object.fromEntries(
    getDateTimeFormatter(timeZone)
      .formatToParts(date)
      .filter((item) => item.type !== "literal")
      .map((item) => [item.type, item.value])
  ) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
}

function getUtcFromZonedParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
) {
  let candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));

  for (let step = 0; step < 3; step += 1) {
    const parts = getDateTimeParts(candidate, timeZone);
    const zonedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
      0
    );

    const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, second, 0);
    const delta = zonedUtc - desiredUtc;

    if (delta === 0) {
      return candidate;
    }

    candidate = new Date(candidate.getTime() - delta);
  }

  return candidate;
}

export function getCareEventTypeLabel(type: CareEventType) {
  return eventTypeLabels[type];
}

export function getReminderTypeLabel(type: ReminderType) {
  return reminderTypeLabels[type];
}

export function getDiaperKindLabel(kind: DiaperKind) {
  return diaperKindLabels[kind];
}

export function getExportFormatLabel(format: ExportFormat) {
  return exportFormatLabels[format];
}

export function formatDurationMinutes(totalMinutes: number) {
  if (totalMinutes <= 0) {
    return "0 мин";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} мин`;
  }

  if (minutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${minutes} мин`;
}

export function calculateChildAgeLabel(birthDate: Date | string, now: Date | string = new Date()) {
  const birth = normalizeDate(birthDate);
  const current = normalizeDate(now);

  if (birth > current) {
    return "0 дн";
  }

  let years = current.getUTCFullYear() - birth.getUTCFullYear();
  let months = current.getUTCMonth() - birth.getUTCMonth();
  let days = current.getUTCDate() - birth.getUTCDate();

  if (days < 0) {
    months -= 1;
    const previousMonth = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 0));
    days += previousMonth.getUTCDate();
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0 && months <= 0) {
    return `${days} дн`;
  }

  if (years <= 0) {
    return `${months} мес${days > 0 ? ` ${days} дн` : ""}`.trim();
  }

  return `${years} г${months > 0 ? ` ${months} мес` : ""}`.trim();
}

export function getDayKeyInTimeZone(dateLike: Date | string, timeZone: string) {
  const date = normalizeDate(dateLike);

  return [
    getDatePart(date, timeZone, "year"),
    getDatePart(date, timeZone, "month"),
    getDatePart(date, timeZone, "day")
  ].join("-");
}

export function getTimeZoneDayRange(dateLike: Date | string, timeZone: string) {
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(dateLike))
    ? String(dateLike)
    : getDayKeyInTimeZone(dateLike, timeZone);

  const [year, month, day] = dateKey.split("-").map(Number);
  const start = getUtcFromZonedParts(year, month, day, 0, 0, 0, timeZone);

  const nextDate = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
  const nextYear = nextDate.getUTCFullYear();
  const nextMonth = nextDate.getUTCMonth() + 1;
  const nextDay = nextDate.getUTCDate();
  const end = getUtcFromZonedParts(nextYear, nextMonth, nextDay, 0, 0, 0, timeZone);

  return { dayKey: dateKey, start, end };
}

export function getCareEventEffectiveDate(event: Pick<CareEventDto, "occurredAt" | "startedAt" | "endedAt">) {
  return event.startedAt ?? event.occurredAt ?? event.endedAt;
}

export function getEventDurationMinutes(event: Pick<CareEventDto, "durationSeconds" | "startedAt" | "endedAt">) {
  if (typeof event.durationSeconds === "number") {
    return Math.max(0, Math.round(event.durationSeconds / 60));
  }

  if (!event.startedAt || !event.endedAt) {
    return 0;
  }

  const startedAt = normalizeDate(event.startedAt);
  const endedAt = normalizeDate(event.endedAt);

  return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
}

export function ensureIdempotencyKey(seed?: string) {
  const normalized = seed?.trim();

  if (normalized) {
    return normalized;
  }

  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildEventIdempotencyKey(input: {
  familyId: string;
  childId: string;
  eventType: CareEventType;
  occurredAt: Date | string;
  clientMutationId?: string | null;
}) {
  if (input.clientMutationId?.trim()) {
    return input.clientMutationId.trim();
  }

  const occurredAt = normalizeDate(input.occurredAt).toISOString();

  return `${input.familyId}:${input.childId}:${input.eventType}:${occurredAt}`;
}

export function getDailySummaryHighlights(summary: Pick<
  DailySummaryDto,
  | "feedingsCount"
  | "totalSleepMinutes"
  | "averageFeedingIntervalMinutes"
  | "wetDiapersCount"
  | "dirtyDiapersCount"
  | "mixedDiapersCount"
>) {
  return {
    feedingsLabel: `${summary.feedingsCount} кормл.`,
    sleepLabel: formatDurationMinutes(summary.totalSleepMinutes),
    averageFeedingIntervalLabel:
      summary.averageFeedingIntervalMinutes === null
        ? "Нет данных"
        : formatDurationMinutes(summary.averageFeedingIntervalMinutes),
    diaperLabel: `${summary.wetDiapersCount + summary.dirtyDiapersCount + summary.mixedDiapersCount} подгузн.`
  };
}

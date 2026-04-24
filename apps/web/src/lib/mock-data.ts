import { actorLabel, calculateAgeLabel, formatDueLabel, formatDuration, formatRelativeFromNow } from "./format";
import type {
  AiInsight,
  CareEventRecord,
  DashboardSnapshot,
  DailySummary,
  EventDraft,
  PeriodSummary,
  ReminderCard,
  SummaryPeriodId,
} from "./types";

const CHILD_BIRTH_DATE = "2026-04-20T09:00:00+03:00";

interface SnapshotChildInput {
  id: string;
  name: string;
  birthDate: string;
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function baseEvents(): CareEventRecord[] {
  return [];
}

const SUMMARY_PERIODS: Array<{ id: SummaryPeriodId; title: string; days: number }> = [
  { id: "1d", title: "1 день", days: 1 },
  { id: "3d", title: "3 дня", days: 3 },
  { id: "7d", title: "Неделя", days: 7 },
  { id: "30d", title: "Месяц", days: 30 },
  { id: "365d", title: "Год", days: 365 },
];

function periodStart(days: number): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - days + 1);
  return start.getTime();
}

function getSummary(events: CareEventRecord[], days = 1): DailySummary {
  const periodEvents = events.filter((event) => new Date(event.occurredAt).getTime() >= periodStart(days));
  const feedingEvents = periodEvents.filter((event) => event.kind === "FEEDING");
  const diaperEvents = periodEvents.filter((event) => event.kind === "DIAPER");
  const sleepStarts = periodEvents
    .filter((event) => event.kind === "SLEEP" && event.payload.phase === "START")
    .sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime());
  const sleepEnds = periodEvents
    .filter((event) => event.kind === "SLEEP" && event.payload.phase === "END")
    .sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime());

  let totalSleepMinutes = 0;
  sleepStarts.forEach((start, index) => {
    const end = sleepEnds[index];
    if (!end) {
      totalSleepMinutes += Math.max(0, Math.round((Date.now() - new Date(start.occurredAt).getTime()) / 60000));
      return;
    }

    totalSleepMinutes += Math.max(
      0,
      Math.round((new Date(end.occurredAt).getTime() - new Date(start.occurredAt).getTime()) / 60000),
    );
  });

  let intervalSum = 0;
  for (let index = 1; index < feedingEvents.length; index += 1) {
    intervalSum += Math.abs(
      Math.round(
        (new Date(feedingEvents[index - 1].occurredAt).getTime() - new Date(feedingEvents[index].occurredAt).getTime()) /
          60000,
      ),
    );
  }

  return {
    dateLabel: new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
    }).format(new Date()),
    feedingsCount: feedingEvents.length,
    solidFoodsCount: periodEvents.filter((event) => event.kind === "SOLID_FOOD").length,
    totalSleepMinutes,
    averageFeedingIntervalMinutes:
      feedingEvents.length > 1 ? Math.round(intervalSum / (feedingEvents.length - 1)) : 0,
    diaperWetCount: diaperEvents.filter((event) => event.payload.type === "WET").length,
    diaperDirtyCount: diaperEvents.filter((event) => event.payload.type === "DIRTY").length,
    diaperMixedCount: diaperEvents.filter((event) => event.payload.type === "MIXED").length,
    temperatureReadingsCount: periodEvents.filter((event) => event.kind === "TEMPERATURE").length,
    medicationsCount: periodEvents.filter((event) => event.kind === "MEDICATION").length,
    growthReadingsCount: periodEvents.filter((event) => event.kind === "GROWTH").length,
  };
}

function getPeriodSummaries(events: CareEventRecord[]): PeriodSummary[] {
  return SUMMARY_PERIODS.map((period) => ({
    ...getSummary(events, period.days),
    ...period,
  }));
}

function getReminders(events: CareEventRecord[]): ReminderCard[] {
  const lastFeed = events.find((event) => event.kind === "FEEDING");
  const lastDiaper = events.find((event) => event.kind === "DIAPER");
  const lastMedication = events.find((event) => event.kind === "MEDICATION");

  const reminders: ReminderCard[] = [];

  if (lastFeed) {
    const dueAt = new Date(new Date(lastFeed.occurredAt).getTime() + 3 * 60 * 60_000).toISOString();
    reminders.push({
      id: "reminder_feeding",
      title: "Следующее кормление",
      dueLabel: formatDueLabel(dueAt),
      tone: new Date(dueAt).getTime() - Date.now() < 30 * 60_000 ? "warn" : "default",
      channel: "bot",
    });
  }

  if (lastDiaper) {
    const dueAt = new Date(new Date(lastDiaper.occurredAt).getTime() + 2 * 60 * 60_000).toISOString();
    reminders.push({
      id: "reminder_diaper",
      title: "Проверка подгузника",
      dueLabel: formatDueLabel(dueAt),
      tone: new Date(dueAt).getTime() - Date.now() < 20 * 60_000 ? "warn" : "default",
      channel: "bot",
    });
  }

  if (lastMedication) {
    const dueAt = new Date(new Date(lastMedication.occurredAt).getTime() + 12 * 60 * 60_000).toISOString();
    reminders.push({
      id: "reminder_medication",
      title: "Следующая доза по графику",
      dueLabel: formatDueLabel(dueAt),
      tone: "default",
      channel: "mini-app",
    });
  }

  return reminders;
}

export function getInsights(snapshot: DashboardSnapshot): AiInsight[] {
  if (snapshot.events.length === 0) {
    return [
      {
        id: "insight_empty",
        title: "Данных пока нет",
        body: "После первой записи здесь появятся подсказки по кормлениям, сну и режиму.",
        tone: "default",
      },
    ];
  }

  const lastFeed = snapshot.events.find((event) => event.kind === "FEEDING");
  const temperatureEvent = snapshot.events.find((event) => event.kind === "TEMPERATURE");

  const insights: AiInsight[] = [
    {
      id: "insight_last_feed",
      title: "Последнее кормление",
      body: lastFeed
        ? `${actorLabel(lastFeed.actor)} отметил(а): ${lastFeed.summary.toLowerCase()} ${formatRelativeFromNow(lastFeed.occurredAt)}.`
        : "Сегодня ещё нет записей о кормлении.",
      tone: "default",
    },
  ];

  if (snapshot.summary.averageFeedingIntervalMinutes > 210) {
    insights.push({
      id: "insight_schedule",
      title: "Режим сегодня",
      body: "Интервалы между кормлениями растянулись. Если ребёнок проснётся сам раньше, лучше предложить кормление без ожидания следующего окна.",
      tone: "warn",
    });
  } else {
    insights.push({
      id: "insight_schedule",
      title: "Режим сегодня",
      body: "Ритм ровный: кормления идут близко к привычному интервалу, а сон не выбивается из дневного окна.",
      tone: "default",
    });
  }

  if (temperatureEvent && Number(temperatureEvent.payload.temperatureC ?? 0) >= 37.5) {
    insights.push({
      id: "insight_temperature",
      title: "Температура под контролем",
      body: "Отмечена повышенная температура. Полезно держать следующий замер и лекарство в напоминаниях, чтобы не пропустить окно.",
      tone: "danger",
    });
  }

  return insights;
}

export function buildSnapshotFromEvents(
  events: CareEventRecord[],
  child: SnapshotChildInput = {
    id: "child_amir",
    name: "Амир",
    birthDate: CHILD_BIRTH_DATE,
  },
): DashboardSnapshot {
  const sortedEvents = [...events].sort(
    (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );

  const lastFeed = sortedEvents.find((event) => event.kind === "FEEDING");
  const lastSleepStart = sortedEvents.find((event) => event.kind === "SLEEP" && event.payload.phase === "START");
  const lastSleepEnd = sortedEvents.find((event) => event.kind === "SLEEP" && event.payload.phase === "END");
  const lastDiaper = sortedEvents.find((event) => event.kind === "DIAPER");
  const lastTemp = sortedEvents.find((event) => event.kind === "TEMPERATURE");
  const lastMedication = sortedEvents.find((event) => event.kind === "MEDICATION");

  const sleeping =
    lastSleepStart &&
    (!lastSleepEnd || new Date(lastSleepStart.occurredAt).getTime() > new Date(lastSleepEnd.occurredAt).getTime());
  const sleepDurationMinutes = sleeping
    ? Math.max(1, Math.round((Date.now() - new Date(lastSleepStart.occurredAt).getTime()) / 60000))
    : undefined;

  const snapshot: DashboardSnapshot = {
    generatedAt: new Date().toISOString(),
    child: {
      id: child.id,
      name: child.name,
      birthDate: child.birthDate,
      ageLabel: calculateAgeLabel(child.birthDate),
    },
    overview: {
      age: calculateAgeLabel(child.birthDate),
      lastFeeding: lastFeed ? `${formatRelativeFromNow(lastFeed.occurredAt)} · ${lastFeed.summary}` : "ещё не логировали",
      sleepStatus: sleeping ? `Спит ${formatDuration(sleepDurationMinutes)}` : "Сейчас бодрствует",
      diaperGap: lastDiaper ? formatRelativeFromNow(lastDiaper.occurredAt) : "ещё не логировали",
      temperature: lastTemp ? lastTemp.summary : "сегодня без измерений",
      medication: lastMedication ? `${lastMedication.summary} · ${formatRelativeFromNow(lastMedication.occurredAt)}` : "лекарств не было",
    },
    reminders: [],
    timers: {
      sleepStartedAt: sleeping ? lastSleepStart.occurredAt : undefined,
      sleepDurationMinutes,
      nextFeedingAt: lastFeed
        ? new Date(new Date(lastFeed.occurredAt).getTime() + 3 * 60 * 60_000).toISOString()
        : undefined,
      nextDiaperCheckAt: lastDiaper
        ? new Date(new Date(lastDiaper.occurredAt).getTime() + 2 * 60 * 60_000).toISOString()
        : undefined,
    },
    summary: getSummary(sortedEvents),
    periodSummaries: getPeriodSummaries(sortedEvents),
    events: sortedEvents,
    insights: [],
  };

  snapshot.reminders = getReminders(sortedEvents);
  snapshot.insights = getInsights(snapshot);
  return snapshot;
}

export function createBaseSnapshot(): DashboardSnapshot {
  return buildSnapshotFromEvents(baseEvents(), {
    id: "child_amir",
    name: "Амир",
    birthDate: CHILD_BIRTH_DATE,
  });
}

export function createEventRecord(draft: EventDraft, source: "server" | "local" = "local"): CareEventRecord {
  return {
    id: createId("evt"),
    idempotencyKey: createId("idem"),
    kind: draft.kind,
    actor: draft.actor,
    occurredAt: draft.occurredAt,
    summary: draft.summary,
    payload: draft.payload,
    status: draft.status ?? "LOGGED",
    source,
  };
}

export function mergeSnapshot(
  snapshot: DashboardSnapshot,
  localEvents: CareEventRecord[],
  overrides: Record<string, Partial<CareEventRecord>>,
): DashboardSnapshot {
  const deduped = new Map<string, CareEventRecord>();

  [...snapshot.events, ...localEvents].forEach((event) => {
    const key = event.idempotencyKey || event.id;
    deduped.set(key, { ...event, ...(overrides[event.id] ?? {}) });
  });

  return buildSnapshotFromEvents(Array.from(deduped.values()), snapshot.child);
}

export function upsertSnapshotEvent(snapshot: DashboardSnapshot, event: CareEventRecord): DashboardSnapshot {
  const events = snapshot.events.filter((item) => item.id !== event.id && item.idempotencyKey !== event.idempotencyKey);
  return buildSnapshotFromEvents([event, ...events], snapshot.child);
}

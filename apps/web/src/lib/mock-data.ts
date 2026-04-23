import { actorLabel, calculateAgeLabel, formatDueLabel, formatDuration, formatRelativeFromNow } from "./format";
import type { AiInsight, CareEventRecord, DashboardSnapshot, DailySummary, EventDraft, ReminderCard } from "./types";

const CHILD_BIRTH_DATE = "2026-04-20T09:00:00+03:00";

interface SnapshotChildInput {
  id: string;
  name: string;
  birthDate: string;
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowMinus(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function todayStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function baseEvents(): CareEventRecord[] {
  const events: CareEventRecord[] = [
    {
      id: "evt_feed_1",
      idempotencyKey: "seed_feed_1",
      kind: "FEEDING",
      actor: "mom",
      occurredAt: nowMinus(95),
      summary: "Грудь — 18 мин",
      payload: { mode: "BREAST", durationMinutes: 18 },
      status: "COMPLETED",
      source: "server",
    },
    {
      id: "evt_temp_1",
      idempotencyKey: "seed_temp_1",
      kind: "TEMPERATURE",
      actor: "dad",
      occurredAt: nowMinus(170),
      summary: "Температура 36.8°C",
      payload: { temperatureC: 36.8 },
      status: "LOGGED",
      source: "server",
    },
    {
      id: "evt_sleep_1",
      idempotencyKey: "seed_sleep_1",
      kind: "SLEEP",
      actor: "dad",
      occurredAt: nowMinus(32),
      summary: "Сон начался",
      payload: { phase: "START" },
      status: "STARTED",
      source: "server",
    },
    {
      id: "evt_diaper_1",
      idempotencyKey: "seed_diaper_1",
      kind: "DIAPER",
      actor: "mom",
      occurredAt: nowMinus(118),
      summary: "Подгузник — моча",
      payload: { type: "WET" },
      status: "LOGGED",
      source: "server",
    },
    {
      id: "evt_med_1",
      idempotencyKey: "seed_med_1",
      kind: "MEDICATION",
      actor: "mom",
      occurredAt: nowMinus(420),
      summary: "Витамин D — 1 капля",
      payload: { medication: "Витамин D", dose: "1 капля" },
      status: "COMPLETED",
      source: "server",
    },
    {
      id: "evt_feed_2",
      idempotencyKey: "seed_feed_2",
      kind: "FEEDING",
      actor: "dad",
      occurredAt: nowMinus(275),
      summary: "Бутылочка — 120 мл",
      payload: { mode: "BOTTLE", volumeMl: 120 },
      status: "COMPLETED",
      source: "server",
    },
    {
      id: "evt_note_1",
      idempotencyKey: "seed_note_1",
      kind: "NOTE",
      actor: "mom",
      occurredAt: nowMinus(510),
      summary: "Настроение спокойное, хорошо уснул после прогулки",
      payload: { note: "Настроение спокойное, хорошо уснул после прогулки" },
      status: "LOGGED",
      source: "server",
    },
    {
      id: "evt_sleep_0",
      idempotencyKey: "seed_sleep_0",
      kind: "SLEEP",
      actor: "mom",
      occurredAt: nowMinus(275),
      summary: "Проснулся",
      payload: { phase: "END" },
      status: "COMPLETED",
      source: "server",
    },
  ];

  return events.sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());
}

function isToday(timestamp: string): boolean {
  return new Date(timestamp).getTime() >= todayStart();
}

function getSummary(events: CareEventRecord[]): DailySummary {
  const todayEvents = events.filter((event) => isToday(event.occurredAt));
  const feedingEvents = todayEvents.filter((event) => event.kind === "FEEDING");
  const diaperEvents = todayEvents.filter((event) => event.kind === "DIAPER");
  const sleepStarts = todayEvents
    .filter((event) => event.kind === "SLEEP" && event.payload.phase === "START")
    .sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime());
  const sleepEnds = todayEvents
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
    totalSleepMinutes,
    averageFeedingIntervalMinutes:
      feedingEvents.length > 1 ? Math.round(intervalSum / (feedingEvents.length - 1)) : 0,
    diaperWetCount: diaperEvents.filter((event) => event.payload.type === "WET").length,
    diaperDirtyCount: diaperEvents.filter((event) => event.payload.type === "DIRTY").length,
    temperatureReadingsCount: todayEvents.filter((event) => event.kind === "TEMPERATURE").length,
    medicationsCount: todayEvents.filter((event) => event.kind === "MEDICATION").length,
  };
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

  return buildSnapshotFromEvents(Array.from(deduped.values()));
}

export function upsertSnapshotEvent(snapshot: DashboardSnapshot, event: CareEventRecord): DashboardSnapshot {
  const events = snapshot.events.filter((item) => item.id !== event.id && item.idempotencyKey !== event.idempotencyKey);
  return buildSnapshotFromEvents([event, ...events]);
}

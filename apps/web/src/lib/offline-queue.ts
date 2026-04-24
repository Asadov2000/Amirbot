import type { ActorId, CareEventRecord } from "./types";

const ACTOR_KEY = "amir.actor";
const LOCAL_EVENTS_KEY = "amir.local-events";
const PENDING_EVENTS_KEY = "amir.pending-events";
const OVERRIDES_KEY = "amir.event-overrides";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(key);
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Telegram Desktop can keep broken storage entries between Mini App deploys.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isCareEventRecord(value: unknown): value is CareEventRecord {
  if (!isRecord(value)) {
    return false;
  }

  const kind = value.kind;
  const actor = value.actor;
  const status = value.status;
  const source = value.source;

  return (
    typeof value.id === "string" &&
    typeof value.idempotencyKey === "string" &&
    typeof value.occurredAt === "string" &&
    !Number.isNaN(new Date(value.occurredAt).getTime()) &&
    typeof value.summary === "string" &&
    isRecord(value.payload) &&
    (actor === "mom" || actor === "dad") &&
    ["FEEDING", "SLEEP", "DIAPER", "TEMPERATURE", "MEDICATION", "NOTE"].includes(String(kind)) &&
    ["LOGGED", "STARTED", "COMPLETED"].includes(String(status)) &&
    (source === "server" || source === "local")
  );
}

function readEvents(key: string): CareEventRecord[] {
  const rawEvents = readJson<unknown[]>(key, []);
  const safeEvents = rawEvents.filter(isCareEventRecord);

  if (safeEvents.length !== rawEvents.length) {
    writeJson(key, safeEvents);
  }

  return safeEvents;
}

export function getStoredActor(): ActorId {
  const actor = readJson<ActorId>(ACTOR_KEY, "mom");
  return actor === "dad" || actor === "mom" ? actor : "mom";
}

export function setStoredActor(actor: ActorId): void {
  writeJson(ACTOR_KEY, actor);
}

export function getLocalEvents(): CareEventRecord[] {
  return readEvents(LOCAL_EVENTS_KEY);
}

export function saveLocalEvents(events: CareEventRecord[]): void {
  writeJson(LOCAL_EVENTS_KEY, events);
}

export function upsertLocalEvent(event: CareEventRecord): CareEventRecord[] {
  const next = [event, ...getLocalEvents().filter((item) => item.id !== event.id)];
  saveLocalEvents(next);
  return next;
}

export function removeLocalEvent(eventId: string): CareEventRecord[] {
  const next = getLocalEvents().filter((item) => item.id !== eventId);
  saveLocalEvents(next);
  return next;
}

export function replaceLocalEvent(localEventId: string, serverEvent: CareEventRecord): CareEventRecord[] {
  const next = [serverEvent, ...getLocalEvents().filter((item) => item.id !== localEventId && item.id !== serverEvent.id)];
  saveLocalEvents(next);
  return next;
}

export function getPendingEvents(): CareEventRecord[] {
  return readEvents(PENDING_EVENTS_KEY);
}

export function enqueuePendingEvent(event: CareEventRecord): CareEventRecord[] {
  const next = [event, ...getPendingEvents().filter((item) => item.id !== event.id)];
  writeJson(PENDING_EVENTS_KEY, next);
  return next;
}

export function removePendingEvent(eventId: string): CareEventRecord[] {
  const next = getPendingEvents().filter((item) => item.id !== eventId);
  writeJson(PENDING_EVENTS_KEY, next);
  return next;
}

export function getEventOverrides(): Record<string, Partial<CareEventRecord>> {
  const overrides = readJson<Record<string, Partial<CareEventRecord>>>(OVERRIDES_KEY, {});
  return isRecord(overrides) ? overrides : {};
}

export function saveEventOverride(event: CareEventRecord): Record<string, Partial<CareEventRecord>> {
  const next = {
    ...getEventOverrides(),
    [event.id]: {
      occurredAt: event.occurredAt,
      actor: event.actor,
      summary: event.summary,
      payload: event.payload,
      editedAt: new Date().toISOString(),
      source: "local" as const,
    },
  };
  writeJson(OVERRIDES_KEY, next);
  return next;
}

export function removeEventOverride(eventId: string): Record<string, Partial<CareEventRecord>> {
  const next = { ...getEventOverrides() };
  delete next[eventId];
  writeJson(OVERRIDES_KEY, next);
  return next;
}

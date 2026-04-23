import type { ActorId, CareEventRecord } from "./types";

const ACTOR_KEY = "amir.actor";
const LOCAL_EVENTS_KEY = "amir.local-events";
const PENDING_EVENTS_KEY = "amir.pending-events";
const OVERRIDES_KEY = "amir.event-overrides";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getStoredActor(): ActorId {
  return readJson<ActorId>(ACTOR_KEY, "mom");
}

export function setStoredActor(actor: ActorId): void {
  writeJson(ACTOR_KEY, actor);
}

export function getLocalEvents(): CareEventRecord[] {
  return readJson<CareEventRecord[]>(LOCAL_EVENTS_KEY, []);
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
  return readJson<CareEventRecord[]>(PENDING_EVENTS_KEY, []);
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
  return readJson<Record<string, Partial<CareEventRecord>>>(OVERRIDES_KEY, {});
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

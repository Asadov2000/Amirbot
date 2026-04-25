import type {
  ActorId,
  CareEventRecord,
  DashboardSnapshot,
  EventDraft,
} from "./types";

const ACTOR_KEY = "amir.actor";
const SNAPSHOT_KEY = "amir.last-snapshot";
const LOCAL_EVENTS_KEY = "amir.local-events";
const PENDING_EVENTS_KEY = "amir.pending-events";
const OVERRIDES_KEY = "amir.event-overrides";

export type PendingSyncOperation =
  | {
      id: string;
      operation: "create";
      localEventId: string;
      draft: EventDraft;
      localEvent: CareEventRecord;
      createdAt: string;
    }
  | {
      id: string;
      operation: "update";
      localEventId: string;
      serverEventId: string;
      draft: EventDraft;
      localEvent: CareEventRecord;
      createdAt: string;
    };

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
    [
      "FEEDING",
      "SOLID_FOOD",
      "SLEEP",
      "DIAPER",
      "TEMPERATURE",
      "MEDICATION",
      "GROWTH",
      "NOTE",
    ].includes(String(kind)) &&
    ["LOGGED", "STARTED", "COMPLETED"].includes(String(status)) &&
    (source === "server" || source === "local")
  );
}

function isEventDraft(value: unknown): value is EventDraft {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.kind === "string" &&
    (value.actor === "mom" || value.actor === "dad") &&
    typeof value.occurredAt === "string" &&
    typeof value.summary === "string" &&
    isRecord(value.payload)
  );
}

function isDashboardSnapshot(value: unknown): value is DashboardSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.generatedAt === "string" &&
    isRecord(value.child) &&
    Array.isArray(value.events) &&
    Array.isArray(value.quickItems)
  );
}

function draftFromEvent(event: CareEventRecord): EventDraft {
  const clientRequestId =
    event.clientRequestId ??
    (typeof event.payload.clientRequestId === "string"
      ? event.payload.clientRequestId
      : event.idempotencyKey);

  return {
    kind: event.kind,
    actor: event.actor,
    occurredAt: event.occurredAt,
    summary: event.summary,
    payload: event.payload,
    status: event.status,
    clientRequestId,
    expectedRevision: event.revision,
  };
}

function isPendingSyncOperation(value: unknown): value is PendingSyncOperation {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.localEventId !== "string" ||
    typeof value.createdAt !== "string" ||
    !isEventDraft(value.draft) ||
    !isCareEventRecord(value.localEvent)
  ) {
    return false;
  }

  if (value.operation === "create") {
    return true;
  }

  return (
    value.operation === "update" && typeof value.serverEventId === "string"
  );
}

function operationFromLegacyEvent(
  event: CareEventRecord,
): PendingSyncOperation {
  return {
    id: `legacy-create:${event.id}`,
    operation: "create",
    localEventId: event.id,
    draft: draftFromEvent(event),
    localEvent: event,
    createdAt: new Date().toISOString(),
  };
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

export function getCachedSnapshot(): DashboardSnapshot | null {
  const snapshot = readJson<unknown>(SNAPSHOT_KEY, null);
  if (snapshot === null) {
    return null;
  }

  if (!isDashboardSnapshot(snapshot)) {
    window.localStorage.removeItem(SNAPSHOT_KEY);
    return null;
  }

  return snapshot;
}

export function saveCachedSnapshot(snapshot: DashboardSnapshot): void {
  writeJson(SNAPSHOT_KEY, snapshot);
}

export function getLocalEvents(): CareEventRecord[] {
  return readEvents(LOCAL_EVENTS_KEY);
}

export function saveLocalEvents(events: CareEventRecord[]): void {
  writeJson(LOCAL_EVENTS_KEY, events);
}

export function upsertLocalEvent(event: CareEventRecord): CareEventRecord[] {
  const next = [
    event,
    ...getLocalEvents().filter((item) => item.id !== event.id),
  ];
  saveLocalEvents(next);
  return next;
}

export function removeLocalEvent(eventId: string): CareEventRecord[] {
  const next = getLocalEvents().filter((item) => item.id !== eventId);
  saveLocalEvents(next);
  return next;
}

export function replaceLocalEvent(
  localEventId: string,
  serverEvent: CareEventRecord,
): CareEventRecord[] {
  const next = [
    serverEvent,
    ...getLocalEvents().filter(
      (item) => item.id !== localEventId && item.id !== serverEvent.id,
    ),
  ];
  saveLocalEvents(next);
  return next;
}

export function getPendingOperations(): PendingSyncOperation[] {
  const rawItems = readJson<unknown[]>(PENDING_EVENTS_KEY, []);
  const operations = rawItems
    .map((item) => {
      if (isPendingSyncOperation(item)) {
        return item;
      }

      if (isCareEventRecord(item)) {
        return operationFromLegacyEvent(item);
      }

      return null;
    })
    .filter((item): item is PendingSyncOperation => Boolean(item));

  if (
    operations.length !== rawItems.length ||
    rawItems.some((item) => !isPendingSyncOperation(item))
  ) {
    writeJson(PENDING_EVENTS_KEY, operations);
  }

  return operations;
}

export function enqueuePendingOperation(
  operation: PendingSyncOperation,
): PendingSyncOperation[] {
  const next = [
    operation,
    ...getPendingOperations().filter((item) => {
      if (item.id === operation.id) {
        return false;
      }

      if (
        item.operation === "update" &&
        operation.operation === "update" &&
        item.serverEventId === operation.serverEventId
      ) {
        return false;
      }

      if (
        item.operation === "create" &&
        operation.operation === "create" &&
        item.localEventId === operation.localEventId
      ) {
        return false;
      }

      return true;
    }),
  ];
  writeJson(PENDING_EVENTS_KEY, next);
  return next;
}

export function removePendingOperation(
  operationId: string,
): PendingSyncOperation[] {
  const next = getPendingOperations().filter((item) => item.id !== operationId);
  writeJson(PENDING_EVENTS_KEY, next);
  return next;
}

export function getEventOverrides(): Record<string, Partial<CareEventRecord>> {
  const overrides = readJson<Record<string, Partial<CareEventRecord>>>(
    OVERRIDES_KEY,
    {},
  );
  return isRecord(overrides) ? overrides : {};
}

export function saveEventOverride(
  event: CareEventRecord,
): Record<string, Partial<CareEventRecord>> {
  const next = {
    ...getEventOverrides(),
    [event.id]: {
      occurredAt: event.occurredAt,
      actor: event.actor,
      summary: event.summary,
      payload: event.payload,
      revision: event.revision,
      editedAt: new Date().toISOString(),
      source: "local" as const,
    },
  };
  writeJson(OVERRIDES_KEY, next);
  return next;
}

export function removeEventOverride(
  eventId: string,
): Record<string, Partial<CareEventRecord>> {
  const next = { ...getEventOverrides() };
  delete next[eventId];
  writeJson(OVERRIDES_KEY, next);
  return next;
}

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
const CORRUPT_STORAGE_PREFIX = "amir.corrupt";
const STORAGE_ERROR_MESSAGE =
  "Не удалось сохранить запись на устройстве. Проверьте свободное место и настройки Telegram, затем повторите.";

export class OfflineStorageError extends Error {
  public constructor(message = STORAGE_ERROR_MESSAGE) {
    super(message);
    this.name = "OfflineStorageError";
  }
}

export type PendingSyncOperation =
  | {
      id: string;
      operation: "create";
      localEventId: string;
      draft: EventDraft;
      localEvent: CareEventRecord;
      createdAt: string;
      conflictedAt?: string;
      lastError?: string;
    }
  | {
      id: string;
      operation: "update";
      localEventId: string;
      serverEventId: string;
      draft: EventDraft;
      localEvent: CareEventRecord;
      createdAt: string;
      conflictedAt?: string;
      lastError?: string;
    };

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
    try {
      window.localStorage.setItem(
        `${CORRUPT_STORAGE_PREFIX}.${key}.${Date.now()}`,
        raw,
      );
      window.localStorage.removeItem(key);
    } catch {
      // Keep the broken value if it cannot be safely quarantined.
    }
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Telegram Desktop can keep broken storage entries between Mini App deploys.
    return false;
  }
}

function requireWriteJson<T>(key: string, value: T): void {
  if (!writeJson(key, value)) {
    throw new OfflineStorageError();
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
    (value.conflictedAt !== undefined &&
      typeof value.conflictedAt !== "string") ||
    (value.lastError !== undefined && typeof value.lastError !== "string") ||
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
  requireWriteJson(PENDING_EVENTS_KEY, next);
  return next;
}

export function removePendingOperation(
  operationId: string,
): PendingSyncOperation[] {
  const next = getPendingOperations().filter((item) => item.id !== operationId);
  writeJson(PENDING_EVENTS_KEY, next);
  return next;
}

function isSamePendingOperation(
  current: PendingSyncOperation,
  candidate: PendingSyncOperation,
) {
  return (
    current.id === candidate.id &&
    current.operation === candidate.operation &&
    current.localEventId === candidate.localEventId &&
    current.createdAt === candidate.createdAt &&
    JSON.stringify(current.draft) === JSON.stringify(candidate.draft) &&
    JSON.stringify(current.localEvent) === JSON.stringify(candidate.localEvent)
  );
}

export function removePendingOperationIfUnchanged(
  operation: PendingSyncOperation,
): boolean {
  let removed = false;
  const next = getPendingOperations().filter((item) => {
    if (item.id !== operation.id) {
      return true;
    }

    if (isSamePendingOperation(item, operation)) {
      removed = true;
      return false;
    }

    return true;
  });

  if (removed && !writeJson(PENDING_EVENTS_KEY, next)) {
    return false;
  }

  return removed;
}

export function markPendingOperationConflicted(
  operation: PendingSyncOperation,
  message: string,
): PendingSyncOperation[] {
  const next = getPendingOperations().map((item) =>
    isSamePendingOperation(item, operation)
      ? {
          ...item,
          conflictedAt: new Date().toISOString(),
          lastError: message,
        }
      : item,
  );
  requireWriteJson(PENDING_EVENTS_KEY, next);
  return next;
}

export function getPendingLocalEvents(): CareEventRecord[] {
  return getPendingOperations().map((operation) => operation.localEvent);
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

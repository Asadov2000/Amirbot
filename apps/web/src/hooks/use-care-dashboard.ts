"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import {
  enqueuePendingOperation,
  getCachedSnapshot,
  getEventOverrides,
  getLocalEvents,
  getPendingLocalEvents,
  getPendingOperations,
  getStoredActor,
  markPendingOperationConflicted,
  removeEventOverride,
  removeLocalEvent,
  removePendingOperationIfUnchanged,
  saveEventOverride,
  saveCachedSnapshot,
  setStoredActor,
  upsertLocalEvent,
  type PendingSyncOperation,
} from "@/lib/offline-queue";
import {
  createBaseSnapshot,
  createEventRecord,
  mergeSnapshot,
  upsertSnapshotEvent,
} from "@/lib/mock-data";
import {
  buildTelegramHeaders,
  resolveTelegramActor,
} from "@/lib/telegram-identity";
import type {
  ActorId,
  CareEventRecord,
  DashboardSnapshot,
  EventDraft,
  QuickItemKind,
} from "@/lib/types";

const REQUEST_TIMEOUT_MS = 12_000;
const SYNC_STATE_INTERVAL_MS = 2_000;
const FULL_SYNC_INTERVAL_MS = 20_000;
const SYNC_LOCK_KEY = "amir.sync-lock";
const SYNC_PULSE_KEY = "amir.sync-pulse";
const SYNC_LOCK_TTL_MS = 14_000;

class ApiRequestError extends Error {
  public constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

interface SessionResponse {
  ok: boolean;
  actor: ActorId;
  displayName: string;
}

interface SyncStateResponse {
  ok: boolean;
  syncVersion: string;
  lastSyncedAt: string;
  generatedAt: string;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  const response = await fetch(url, {
    ...options,
    signal: options?.signal ?? controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  }).finally(() => window.clearTimeout(timeoutId));

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error ?? message;
    } catch {
      // Keep the status-only message when the response is not JSON.
    }
    throw new ApiRequestError(message, response.status);
  }

  return (await response.json()) as T;
}

function createClientRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getEventClientRequestId(event: CareEventRecord) {
  return (
    event.clientRequestId ??
    (typeof event.payload.clientRequestId === "string"
      ? event.payload.clientRequestId
      : undefined)
  );
}

function normalizeDraftForSync(
  draft: EventDraft,
  clientRequestId = draft.clientRequestId ?? createClientRequestId(),
) {
  return {
    ...draft,
    clientRequestId,
    payload: {
      ...draft.payload,
      clientRequestId,
    },
  } satisfies EventDraft;
}

function draftFromEventRecord(
  event: CareEventRecord,
  expectedRevision = event.revision,
) {
  const clientRequestId =
    getEventClientRequestId(event) ??
    event.idempotencyKey ??
    createClientRequestId();

  return normalizeDraftForSync(
    {
      kind: event.kind,
      actor: event.actor,
      occurredAt: event.occurredAt,
      summary: event.summary,
      payload: event.payload,
      status: event.status,
      expectedRevision,
    },
    clientRequestId,
  );
}

function createPendingCreateOperation(
  localEvent: CareEventRecord,
  draft: EventDraft,
): PendingSyncOperation {
  return {
    id: `create:${draft.clientRequestId ?? localEvent.id}`,
    operation: "create",
    localEventId: localEvent.id,
    draft,
    localEvent,
    createdAt: new Date().toISOString(),
  };
}

function createPendingUpdateOperation(
  localEvent: CareEventRecord,
  serverEventId: string,
  draft: EventDraft,
): PendingSyncOperation {
  return {
    id: `update:${serverEventId}`,
    operation: "update",
    localEventId: localEvent.id,
    serverEventId,
    draft,
    localEvent,
    createdAt: new Date().toISOString(),
  };
}

function isLocalBrowser() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.endsWith(".local")
  );
}

function createSyncLockId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function acquireSyncLock(lockId: string) {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const now = Date.now();
    const rawLock = window.localStorage.getItem(SYNC_LOCK_KEY);
    const currentLock = rawLock
      ? (JSON.parse(rawLock) as { id?: string; expiresAt?: number })
      : null;

    if (
      currentLock?.id &&
      currentLock.expiresAt &&
      currentLock.expiresAt > now
    ) {
      return currentLock.id === lockId;
    }

    window.localStorage.setItem(
      SYNC_LOCK_KEY,
      JSON.stringify({ id: lockId, expiresAt: now + SYNC_LOCK_TTL_MS }),
    );
    return true;
  } catch {
    return true;
  }
}

function releaseSyncLock(lockId: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const rawLock = window.localStorage.getItem(SYNC_LOCK_KEY);
    const currentLock = rawLock
      ? (JSON.parse(rawLock) as { id?: string })
      : null;

    if (currentLock?.id === lockId) {
      window.localStorage.removeItem(SYNC_LOCK_KEY);
    }
  } catch {
    window.localStorage.removeItem(SYNC_LOCK_KEY);
  }
}

function publishSyncPulse() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SYNC_PULSE_KEY, new Date().toISOString());
  } catch {
    // Sync pulse is best-effort; polling still keeps devices current.
  }
}

function snapshotVersionRank(snapshot: DashboardSnapshot) {
  return snapshot.syncVersion ?? snapshot.snapshotVersion ?? null;
}

function getDurableLocalEvents() {
  const eventsById = new Map<string, CareEventRecord>();
  [...getLocalEvents(), ...getPendingLocalEvents()].forEach((event) => {
    eventsById.set(event.id, event);
  });
  return Array.from(eventsById.values());
}

function isUnsyncedCreateEvent(event: CareEventRecord) {
  return event.source === "local" && typeof event.revision !== "number";
}

export function useCareDashboard() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [activeActor, setActiveActor] = useState<ActorId>("mom");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [actorLocked, setActorLocked] = useState(false);
  const [actorDisplayName, setActorDisplayName] = useState("Мама");
  const [accessDenied, setAccessDenied] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [lastSyncedAt, setLastSyncedAt] = useState<string>("");
  const syncInFlightRef = useRef(false);
  const latestSyncVersionRef = useRef<string | null>(null);

  const updatePendingCounters = () => {
    const pendingOperations = getPendingOperations();
    setPendingCount(pendingOperations.length);
    setConflictCount(
      pendingOperations.filter((operation) => operation.conflictedAt).length,
    );
  };

  const refreshSnapshot = useEffectEvent(async (showLoading = true) => {
    if (accessDenied) {
      return;
    }

    if (showLoading) {
      setLoading(true);
    }
    try {
      const baseSnapshot = await fetchJson<DashboardSnapshot>(
        `/api/dashboard?ts=${Date.now()}`,
        {
          headers: buildTelegramHeaders(activeActor),
        },
      );
      const incomingVersion = snapshotVersionRank(baseSnapshot);
      latestSyncVersionRef.current =
        incomingVersion ?? latestSyncVersionRef.current;
      saveCachedSnapshot(baseSnapshot);
      const localEvents = getDurableLocalEvents();
      const overrides = getEventOverrides();
      const mergedSnapshot = mergeSnapshot(
        baseSnapshot,
        localEvents,
        overrides,
      );

      startTransition(() => {
        setSnapshot(mergedSnapshot);
        updatePendingCounters();
        setLastSyncedAt(new Date().toISOString());
        setError("");
      });
    } catch (error) {
      if (error instanceof ApiRequestError && error.statusCode === 403) {
        startTransition(() => {
          setAccessDenied(true);
          setActorLocked(true);
          setActorDisplayName("Нет доступа");
          updatePendingCounters();
          setError(error.message);
        });
        return;
      }

      const cachedSnapshot = getCachedSnapshot();
      const localEvents = getDurableLocalEvents();
      if (!cachedSnapshot && !isLocalBrowser() && localEvents.length === 0) {
        startTransition(() => {
          updatePendingCounters();
          setError("Не удалось загрузить данные семьи. Проверьте соединение.");
        });
        return;
      }

      const fallbackSnapshot = mergeSnapshot(
        cachedSnapshot ?? createBaseSnapshot(),
        localEvents,
        getEventOverrides(),
      );
      startTransition(() => {
        setSnapshot((current) => current ?? fallbackSnapshot);
        updatePendingCounters();
        setError("");
      });
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  });

  const refreshAi = useEffectEvent(async () => {
    if (accessDenied) {
      return;
    }

    try {
      const response = await fetchJson<{ answer: string }>("/api/ai", {
        headers: buildTelegramHeaders(activeActor),
      });
      setAiAnswer(response.answer);
    } catch {
      setAiAnswer("Подсказка временно недоступна.");
    }
  });

  const refreshSession = useEffectEvent(async () => {
    const response = await fetchJson<SessionResponse>("/api/session", {
      headers: buildTelegramHeaders(activeActor),
    });

    startTransition(() => {
      setActiveActor(response.actor);
      setActorLocked(true);
      setActorDisplayName(response.displayName);
      setStoredActor(response.actor);
      setAccessDenied(false);
      setError("");
    });

    return response.actor;
  });

  const syncPendingEvents = useEffectEvent(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    if (syncInFlightRef.current) {
      return;
    }

    const pendingOperations = getPendingOperations().filter(
      (operation) => !operation.conflictedAt,
    );
    if (pendingOperations.length === 0) {
      updatePendingCounters();
      return;
    }

    const lockId = createSyncLockId();
    if (!acquireSyncLock(lockId)) {
      return;
    }

    syncInFlightRef.current = true;
    setSyncing(true);
    try {
      for (const operation of pendingOperations) {
        try {
          const response =
            operation.operation === "create"
              ? await fetchJson<{
                  ok: boolean;
                  event: CareEventRecord;
                }>("/api/events", {
                  method: "POST",
                  headers: buildTelegramHeaders(operation.draft.actor),
                  body: JSON.stringify(operation.draft),
                })
              : await fetchJson<{
                  ok: boolean;
                  event: CareEventRecord;
                }>("/api/events", {
                  method: "PUT",
                  headers: buildTelegramHeaders(activeActor),
                  body: JSON.stringify({
                    id: operation.serverEventId,
                    draft: operation.draft,
                  }),
                });

          const operationRemoved = removePendingOperationIfUnchanged(operation);
          if (operationRemoved) {
            removeLocalEvent(operation.localEventId);
            removeEventOverride(operation.localEventId);
            if (operation.operation === "update") {
              removeEventOverride(operation.serverEventId);
            }
          }

          startTransition(() => {
            if (!operationRemoved) {
              return;
            }

            setSnapshot((current) =>
              current ? upsertSnapshotEvent(current, response.event) : current,
            );
          });
          publishSyncPulse();
        } catch (error) {
          if (error instanceof ApiRequestError && error.statusCode === 409) {
            markPendingOperationConflicted(operation, error.message);
            updatePendingCounters();
            setError(error.message);
            continue;
          }

          if (
            error instanceof ApiRequestError &&
            (error.statusCode === 400 || error.statusCode === 403)
          ) {
            markPendingOperationConflicted(operation, error.message);
            updatePendingCounters();
            setError(error.message);
            break;
          }

          throw error;
        }
      }
      updatePendingCounters();
    } finally {
      setSyncing(false);
      syncInFlightRef.current = false;
      releaseSyncLock(lockId);
    }
  });

  const syncWithServer = useEffectEvent(async (showLoading = false) => {
    if (accessDenied || (!actorLocked && !isLocalBrowser())) {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      updatePendingCounters();
      return;
    }

    try {
      await syncPendingEvents();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Синхронизация временно недоступна.",
      );
    }
    await refreshSnapshot(showLoading);
  });

  const checkRemoteSyncState = useEffectEvent(async () => {
    if (accessDenied || (!actorLocked && !isLocalBrowser())) {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      updatePendingCounters();
      return;
    }

    const hasPendingSync = getPendingOperations().some(
      (operation) => !operation.conflictedAt,
    );
    if (hasPendingSync) {
      await syncWithServer(false);
      return;
    }

    const state = await fetchJson<SyncStateResponse>(
      `/api/sync?ts=${Date.now()}`,
      {
        headers: buildTelegramHeaders(activeActor),
      },
    );

    if (latestSyncVersionRef.current === null) {
      latestSyncVersionRef.current = state.syncVersion;
      await refreshSnapshot(false);
      return;
    }

    if (state.syncVersion !== latestSyncVersionRef.current) {
      await refreshSnapshot(false);
      return;
    }

    updatePendingCounters();
    setLastSyncedAt(new Date().toISOString());
    setError("");
  });

  useEffect(() => {
    const syncNow = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void checkRemoteSyncState().catch(() => {
        updatePendingCounters();
      });
    };

    const intervalId = window.setInterval(syncNow, SYNC_STATE_INTERVAL_MS);
    const fullIntervalId = window.setInterval(() => {
      if (document.visibilityState !== "hidden") {
        void syncWithServer(false).catch(() => {
          updatePendingCounters();
        });
      }
    }, FULL_SYNC_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncWithServer(false).catch(() => {
          updatePendingCounters();
        });
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    const onStorage = (event: StorageEvent) => {
      if (event.key === SYNC_PULSE_KEY) {
        void syncWithServer(false).catch(() => {
          updatePendingCounters();
        });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(intervalId);
      window.clearInterval(fullIntervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const storedActor = getStoredActor();
    let retryId: number | undefined;
    let attempts = 0;

    setActiveActor(storedActor);
    setActorLocked(false);
    setActorDisplayName(storedActor === "dad" ? "Папа" : "Мама");
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);

    const cachedSnapshot = getCachedSnapshot();
    startTransition(() => {
      setSnapshot(
        mergeSnapshot(
          cachedSnapshot ?? createBaseSnapshot(),
          getDurableLocalEvents(),
          getEventOverrides(),
        ),
      );
      updatePendingCounters();
      setLoading(false);
    });

    const resolveTelegram = () => {
      attempts += 1;
      const telegramActor = resolveTelegramActor();

      if (!telegramActor) {
        if (attempts < 14) {
          retryId = window.setTimeout(resolveTelegram, 150);
          return;
        }

        if (!isLocalBrowser()) {
          setAccessDenied(true);
          setActorLocked(true);
          setActorDisplayName("Нет доступа");
          setError("Откройте приложение через Telegram аккаунт мамы или папы.");
          return;
        }

        void refreshSnapshot(false);
        void refreshAi();
        return;
      }

      if (!telegramActor.allowed) {
        setAccessDenied(true);
        setActorLocked(true);
        setActorDisplayName("Нет доступа");
        setError("Доступ открыт только маме и папе Амира.");
        return;
      }

      setActiveActor(telegramActor.actor);
      setActorLocked(telegramActor.locked);
      setActorDisplayName(telegramActor.displayName);
      void refreshSession()
        .then(async () => {
          await refreshSnapshot(false);
          void syncPendingEvents()
            .then(() => refreshSnapshot(false))
            .catch((error) => {
              updatePendingCounters();
              setError(
                error instanceof Error
                  ? error.message
                  : "Синхронизация временно недоступна.",
              );
            });
          void refreshAi();
        })
        .catch((error) => {
          setAccessDenied(true);
          setActorLocked(true);
          setActorDisplayName("Нет доступа");
          setError(
            error instanceof Error
              ? error.message
              : "Доступ открыт только маме и папе Амира.",
          );
        });
    };

    resolveTelegram();

    return () => {
      if (retryId) {
        window.clearTimeout(retryId);
      }
    };
  }, []);

  useEffect(() => {
    const onOnline = async () => {
      setOnline(true);
      await syncWithServer(true);
    };

    const onOffline = () => setOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const changeActor = (actor: ActorId) => {
    if (actorLocked) {
      return;
    }

    setActiveActor(actor);
    setActorDisplayName(actor === "dad" ? "Папа" : "Мама");
    setStoredActor(actor);
  };

  const addEvent = useEffectEvent(async (draft: EventDraft) => {
    const syncDraft = normalizeDraftForSync(draft);
    const event = createEventRecord(syncDraft, "local");
    const pendingOperation = createPendingCreateOperation(event, syncDraft);

    try {
      enqueuePendingOperation(pendingOperation);
    } catch (error) {
      const message = errorMessage(
        error,
        "Не удалось сохранить запись на устройстве.",
      );
      setError(message);
      updatePendingCounters();
      throw error;
    }

    const localEvents = upsertLocalEvent(event);

    startTransition(() => {
      setSnapshot((current) =>
        current
          ? mergeSnapshot(current, localEvents, getEventOverrides())
          : current,
      );
      setError("");
    });

    if (typeof navigator !== "undefined" && navigator.onLine) {
      const lockId = createSyncLockId();
      if (!acquireSyncLock(lockId)) {
        updatePendingCounters();
        return event;
      }

      try {
        const response = await fetchJson<{
          ok: boolean;
          event: CareEventRecord;
        }>("/api/events", {
          method: "POST",
          headers: buildTelegramHeaders(syncDraft.actor),
          body: JSON.stringify(syncDraft),
        });
        const operationRemoved =
          removePendingOperationIfUnchanged(pendingOperation);
        const nextLocalEvents = operationRemoved
          ? removeLocalEvent(event.id)
          : getDurableLocalEvents();
        startTransition(() => {
          setSnapshot((current) =>
            current
              ? upsertSnapshotEvent(
                  mergeSnapshot(current, nextLocalEvents, getEventOverrides()),
                  response.event,
                )
              : current,
          );
          updatePendingCounters();
          setError("");
        });
        publishSyncPulse();
        void refreshSnapshot(false);
      } catch (error) {
        if (
          error instanceof ApiRequestError &&
          (error.statusCode === 400 || error.statusCode === 403)
        ) {
          markPendingOperationConflicted(pendingOperation, error.message);
          updatePendingCounters();
          setError(error.message);
          throw error;
        }

        updatePendingCounters();
      } finally {
        releaseSyncLock(lockId);
      }
    } else {
      updatePendingCounters();
    }

    return event;
  });

  const editEvent = useEffectEvent(async (event: CareEventRecord) => {
    const editedEvent: CareEventRecord = {
      ...event,
      editedAt: new Date().toISOString(),
      source: "local",
    };
    const editDraft = draftFromEventRecord(editedEvent, event.revision);
    const shouldCreate = isUnsyncedCreateEvent(event);
    const pendingOperation = shouldCreate
      ? createPendingCreateOperation(editedEvent, editDraft)
      : createPendingUpdateOperation(editedEvent, editedEvent.id, editDraft);

    try {
      enqueuePendingOperation(pendingOperation);
    } catch (error) {
      const message = errorMessage(
        error,
        "Не удалось сохранить правку на устройстве.",
      );
      setError(message);
      updatePendingCounters();
      throw error;
    }

    const localEvents = upsertLocalEvent(editedEvent);
    saveEventOverride(editedEvent);
    startTransition(() => {
      setSnapshot((current) =>
        current
          ? mergeSnapshot(current, localEvents, getEventOverrides())
          : current,
      );
      setError("");
    });

    if (typeof navigator !== "undefined" && navigator.onLine) {
      const lockId = createSyncLockId();
      if (!acquireSyncLock(lockId)) {
        updatePendingCounters();
        return;
      }

      try {
        const response = await fetchJson<{
          ok: boolean;
          event: CareEventRecord;
        }>(
          "/api/events",
          shouldCreate
            ? {
                method: "POST",
                headers: buildTelegramHeaders(editDraft.actor),
                body: JSON.stringify(editDraft),
              }
            : {
                method: "PUT",
                headers: buildTelegramHeaders(activeActor),
                body: JSON.stringify({
                  id: editedEvent.id,
                  draft: editDraft,
                }),
              },
        );
        const operationRemoved =
          removePendingOperationIfUnchanged(pendingOperation);
        const nextLocalEvents = operationRemoved
          ? removeLocalEvent(editedEvent.id)
          : getDurableLocalEvents();
        const nextOverrides = removeEventOverride(editedEvent.id);
        startTransition(() => {
          setSnapshot((current) =>
            current
              ? upsertSnapshotEvent(
                  mergeSnapshot(current, nextLocalEvents, nextOverrides),
                  response.event,
                )
              : current,
          );
          updatePendingCounters();
          setError("");
        });
        publishSyncPulse();
        void refreshSnapshot(false);
      } catch (error) {
        if (error instanceof ApiRequestError && error.statusCode === 409) {
          markPendingOperationConflicted(pendingOperation, error.message);
          updatePendingCounters();
          setError(error.message);
          await refreshSnapshot(false);
          return;
        }

        if (
          error instanceof ApiRequestError &&
          (error.statusCode === 400 || error.statusCode === 403)
        ) {
          markPendingOperationConflicted(pendingOperation, error.message);
          updatePendingCounters();
          setError(error.message);
          throw error;
        }

        updatePendingCounters();
      } finally {
        releaseSyncLock(lockId);
      }
    } else {
      updatePendingCounters();
    }
  });

  const replaceSnapshotEvent = (event: CareEventRecord) => {
    setSnapshot((current) =>
      current ? upsertSnapshotEvent(current, event) : current,
    );
  };

  const downloadExport = useEffectEvent(
    async (
      format: "pdf" | "csv",
      filters?: {
        period?: string;
        kind?: string;
        actor?: string;
      },
    ) => {
      const params = new URLSearchParams({ format });
      if (filters?.period) params.set("period", filters.period);
      if (filters?.kind) params.set("kind", filters.kind);
      if (filters?.actor) params.set("actor", filters.actor);
      const response = await fetch(`/api/exports?${params.toString()}`, {
        headers: buildTelegramHeaders(activeActor),
      });
      if (!response.ok) {
        let message = `Не удалось скачать экспорт: ${response.status}`;
        try {
          const payload = (await response.json()) as { error?: string };
          message = payload.error ?? message;
        } catch {
          // Keep the status-only message when the response is not JSON.
        }
        setError(message);
        throw new ApiRequestError(message, response.status);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        format === "pdf" ? "care-summary.pdf" : "care-summary.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      setError("");
    },
  );

  const deleteQuickItem = useEffectEvent(
    async (kind: QuickItemKind, label: string, key: string) => {
      try {
        await fetchJson<{ ok: boolean; key: string }>("/api/quick-items", {
          method: "DELETE",
          headers: buildTelegramHeaders(activeActor),
          body: JSON.stringify({
            kind,
            label,
            key,
            clientRequestId: createClientRequestId(),
          }),
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Не удалось удалить быструю кнопку.";
        setError(message);
        throw error;
      }

      startTransition(() => {
        setSnapshot((current) =>
          current
            ? {
                ...current,
                quickItems: current.quickItems.filter(
                  (item) => item.key !== key,
                ),
              }
            : current,
        );
      });
      publishSyncPulse();
      void refreshSnapshot(false);
      setError("");
    },
  );

  return {
    snapshot,
    activeActor,
    actorLocked,
    actorDisplayName,
    loading,
    syncing,
    pendingCount,
    conflictCount,
    online,
    lastSyncedAt,
    accessDenied,
    aiAnswer,
    error,
    changeActor,
    addEvent,
    editEvent,
    replaceSnapshotEvent,
    refreshSnapshot,
    refreshAi,
    downloadExport,
    deleteQuickItem,
  };
}

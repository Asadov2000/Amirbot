"use client";

import { startTransition, useEffect, useEffectEvent, useState } from "react";

import {
  enqueuePendingOperation,
  getCachedSnapshot,
  getEventOverrides,
  getLocalEvents,
  getPendingOperations,
  getStoredActor,
  removeEventOverride,
  removeLocalEvent,
  removePendingOperation,
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
const SYNC_INTERVAL_MS = 15_000;

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

export function useCareDashboard() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [activeActor, setActiveActor] = useState<ActorId>("mom");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [actorLocked, setActorLocked] = useState(false);
  const [actorDisplayName, setActorDisplayName] = useState("Мама");
  const [accessDenied, setAccessDenied] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string>("");
  const [error, setError] = useState<string>("");

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
      saveCachedSnapshot(baseSnapshot);
      const localEvents = getLocalEvents();
      const overrides = getEventOverrides();
      const pendingOperations = getPendingOperations();
      const mergedSnapshot = mergeSnapshot(
        baseSnapshot,
        localEvents,
        overrides,
      );

      startTransition(() => {
        setSnapshot(mergedSnapshot);
        setPendingCount(pendingOperations.length);
        setError("");
      });
    } catch {
      const cachedSnapshot = getCachedSnapshot();
      const localEvents = getLocalEvents();
      if (!cachedSnapshot && !isLocalBrowser() && localEvents.length === 0) {
        startTransition(() => {
          setPendingCount(getPendingOperations().length);
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
        setPendingCount(getPendingOperations().length);
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

    const pendingOperations = getPendingOperations();
    if (pendingOperations.length === 0) {
      setPendingCount(0);
      return;
    }

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

          removePendingOperation(operation.id);
          removeLocalEvent(operation.localEventId);
          removeEventOverride(operation.localEventId);
          if (operation.operation === "update") {
            removeEventOverride(operation.serverEventId);
          }

          startTransition(() => {
            setSnapshot((current) =>
              current ? upsertSnapshotEvent(current, response.event) : current,
            );
          });
        } catch (error) {
          if (error instanceof ApiRequestError && error.statusCode === 409) {
            removePendingOperation(operation.id);
            removeLocalEvent(operation.localEventId);
            removeEventOverride(operation.localEventId);
            if (operation.operation === "update") {
              removeEventOverride(operation.serverEventId);
            }
            setError(error.message);
            continue;
          }

          throw error;
        }
      }
      setPendingCount(getPendingOperations().length);
    } finally {
      setSyncing(false);
    }
  });

  const syncWithServer = useEffectEvent(async (showLoading = false) => {
    if (accessDenied || (!actorLocked && !isLocalBrowser())) {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setPendingCount(getPendingOperations().length);
      return;
    }

    await syncPendingEvents();
    await refreshSnapshot(showLoading);
  });

  useEffect(() => {
    const syncNow = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void syncWithServer(false).catch(() => {
        setPendingCount(getPendingOperations().length);
      });
    };

    const intervalId = window.setInterval(syncNow, SYNC_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncWithServer(false).catch(() => {
          setPendingCount(getPendingOperations().length);
        });
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
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
          getLocalEvents(),
          getEventOverrides(),
        ),
      );
      setPendingCount(getPendingOperations().length);
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

      setActiveActor(telegramActor.actor);
      setActorLocked(telegramActor.locked);
      setActorDisplayName(telegramActor.displayName);
      void refreshSession()
        .then(async () => {
          await syncPendingEvents();
          await refreshSnapshot(false);
          void refreshAi();
        })
        .catch(() => {
          setAccessDenied(true);
          setActorLocked(true);
          setActorDisplayName("Нет доступа");
          setError("Доступ открыт только маме и папе Амира.");
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
      try {
        const response = await fetchJson<{
          ok: boolean;
          event: CareEventRecord;
        }>("/api/events", {
          method: "POST",
          headers: buildTelegramHeaders(syncDraft.actor),
          body: JSON.stringify(syncDraft),
        });
        const nextLocalEvents = removeLocalEvent(event.id);
        startTransition(() => {
          setSnapshot((current) =>
            current
              ? upsertSnapshotEvent(
                  mergeSnapshot(current, nextLocalEvents, getEventOverrides()),
                  response.event,
                )
              : current,
          );
        });
      } catch {
        enqueuePendingOperation(createPendingCreateOperation(event, syncDraft));
        setPendingCount(getPendingOperations().length);
      }
    } else {
      enqueuePendingOperation(createPendingCreateOperation(event, syncDraft));
      setPendingCount(getPendingOperations().length);
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
    const shouldCreate = event.source === "local";

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
        const nextLocalEvents = removeLocalEvent(editedEvent.id);
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
        });
      } catch (error) {
        if (error instanceof ApiRequestError && error.statusCode === 409) {
          removeLocalEvent(editedEvent.id);
          removeEventOverride(editedEvent.id);
          setError(error.message);
          await refreshSnapshot(false);
          return;
        }

        enqueuePendingOperation(
          shouldCreate
            ? createPendingCreateOperation(editedEvent, editDraft)
            : createPendingUpdateOperation(
                editedEvent,
                editedEvent.id,
                editDraft,
              ),
        );
        setPendingCount(getPendingOperations().length);
      }
    } else {
      enqueuePendingOperation(
        shouldCreate
          ? createPendingCreateOperation(editedEvent, editDraft)
          : createPendingUpdateOperation(
              editedEvent,
              editedEvent.id,
              editDraft,
            ),
      );
      setPendingCount(getPendingOperations().length);
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
        throw new Error(`Export failed: ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        format === "pdf" ? "care-summary.pdf" : "care-summary.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    },
  );

  const deleteQuickItem = useEffectEvent(
    async (kind: QuickItemKind, label: string, key: string) => {
      await fetchJson<{ ok: boolean; key: string }>("/api/quick-items", {
        method: "DELETE",
        headers: buildTelegramHeaders(activeActor),
        body: JSON.stringify({ kind, label }),
      });

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
    online,
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

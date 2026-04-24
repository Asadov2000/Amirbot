"use client";

import { startTransition, useEffect, useEffectEvent, useState } from "react";

import {
  enqueuePendingEvent,
  getEventOverrides,
  getLocalEvents,
  getPendingEvents,
  getStoredActor,
  removeEventOverride,
  removeLocalEvent,
  removePendingEvent,
  saveEventOverride,
  setStoredActor,
  upsertLocalEvent,
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
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
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
      const localEvents = getLocalEvents();
      const overrides = getEventOverrides();
      const pendingEvents = getPendingEvents();
      const mergedSnapshot = mergeSnapshot(
        baseSnapshot,
        localEvents,
        overrides,
      );

      startTransition(() => {
        setSnapshot(mergedSnapshot);
        setPendingCount(pendingEvents.length);
        setError("");
      });
    } catch {
      const fallbackSnapshot = mergeSnapshot(
        createBaseSnapshot(),
        getLocalEvents(),
        getEventOverrides(),
      );
      startTransition(() => {
        setSnapshot((current) => current ?? fallbackSnapshot);
        setPendingCount(getPendingEvents().length);
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

  const syncPendingEvents = useEffectEvent(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    const pendingEvents = getPendingEvents();
    if (pendingEvents.length === 0) {
      setPendingCount(0);
      return;
    }

    setSyncing(true);
    try {
      for (const event of pendingEvents) {
        const response = await fetchJson<{
          ok: boolean;
          event: CareEventRecord;
        }>("/api/events", {
          method: "POST",
          headers: buildTelegramHeaders(event.actor),
          body: JSON.stringify({
            kind: event.kind,
            actor: event.actor,
            occurredAt: event.occurredAt,
            summary: event.summary,
            payload: event.payload,
            status: event.status,
          } satisfies EventDraft),
        });
        removePendingEvent(event.id);
        removeLocalEvent(event.id);
        removeEventOverride(event.id);
        startTransition(() => {
          setSnapshot((current) =>
            current ? upsertSnapshotEvent(current, response.event) : current,
          );
        });
      }
      setPendingCount(getPendingEvents().length);
    } finally {
      setSyncing(false);
    }
  });

  useEffect(() => {
    const storedActor = getStoredActor();
    let retryId: number | undefined;
    let attempts = 0;

    setActiveActor(storedActor);
    setActorLocked(false);
    setActorDisplayName(storedActor === "dad" ? "Папа" : "Мама");
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);

    startTransition(() => {
      setSnapshot(
        mergeSnapshot(
          createBaseSnapshot(),
          getLocalEvents(),
          getEventOverrides(),
        ),
      );
      setPendingCount(getPendingEvents().length);
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

        void refreshSnapshot(false);
        void refreshAi();
        return;
      }

      if (!telegramActor.allowed) {
        setAccessDenied(true);
        setActorLocked(true);
        setActorDisplayName("Нет доступа");
        setError(telegramActor.deniedReason ?? "Доступ закрыт.");
        return;
      }

      setActiveActor(telegramActor.actor);
      setActorLocked(telegramActor.locked);
      setActorDisplayName(telegramActor.displayName);
      setStoredActor(telegramActor.actor);
      void refreshSnapshot(false);
      void refreshAi();
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
      await syncPendingEvents();
      await refreshSnapshot();
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
    const event = createEventRecord(draft, "local");
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
          headers: buildTelegramHeaders(draft.actor),
          body: JSON.stringify(draft),
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
        enqueuePendingEvent(event);
        setPendingCount(getPendingEvents().length);
      }
    } else {
      enqueuePendingEvent(event);
      setPendingCount(getPendingEvents().length);
    }

    return event;
  });

  const editEvent = useEffectEvent(async (event: CareEventRecord) => {
    const editedEvent: CareEventRecord = {
      ...event,
      editedAt: new Date().toISOString(),
      source: "local",
    };

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
        }>("/api/events", {
          method: "PUT",
          headers: buildTelegramHeaders(activeActor),
          body: JSON.stringify({
            id: editedEvent.id,
            draft: {
              kind: editedEvent.kind,
              actor: editedEvent.actor,
              occurredAt: editedEvent.occurredAt,
              summary: editedEvent.summary,
              payload: editedEvent.payload,
              status: editedEvent.status,
            } satisfies EventDraft,
          }),
        });
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
      } catch {
        enqueuePendingEvent(editedEvent);
        setPendingCount(getPendingEvents().length);
      }
    } else {
      enqueuePendingEvent(editedEvent);
      setPendingCount(getPendingEvents().length);
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

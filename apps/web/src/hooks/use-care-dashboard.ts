"use client";

import { startTransition, useEffect, useEffectEvent, useState } from "react";

import {
  enqueuePendingEvent,
  getEventOverrides,
  getLocalEvents,
  getPendingEvents,
  getStoredActor,
  removePendingEvent,
  saveEventOverride,
  setStoredActor,
  upsertLocalEvent,
} from "@/lib/offline-queue";
import { createEventRecord, mergeSnapshot, upsertSnapshotEvent } from "@/lib/mock-data";
import type { ActorId, CareEventRecord, DashboardSnapshot, EventDraft } from "@/lib/types";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });

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
  const [aiAnswer, setAiAnswer] = useState<string>("");
  const [error, setError] = useState<string>("");

  const refreshSnapshot = useEffectEvent(async () => {
    setLoading(true);
    try {
      const baseSnapshot = await fetchJson<DashboardSnapshot>("/api/dashboard");
      startTransition(() => {
        setSnapshot(mergeSnapshot(baseSnapshot, getLocalEvents(), getEventOverrides()));
        setPendingCount(getPendingEvents().length);
        setError("");
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить дашборд");
    } finally {
      setLoading(false);
    }
  });

  const refreshAi = useEffectEvent(async () => {
    try {
      const response = await fetchJson<{ answer: string }>("/api/ai");
      setAiAnswer(response.answer);
    } catch {
      setAiAnswer("AI-подсказка временно недоступна.");
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
        await fetchJson<{ ok: boolean }>("/api/events", {
          method: "POST",
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
      }
      setPendingCount(getPendingEvents().length);
    } finally {
      setSyncing(false);
    }
  });

  useEffect(() => {
    setActiveActor(getStoredActor());
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    void refreshSnapshot();
    void refreshAi();
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
    setActiveActor(actor);
    setStoredActor(actor);
  };

  const addEvent = useEffectEvent(async (draft: EventDraft) => {
    const event = createEventRecord(draft, "local");
    const localEvents = upsertLocalEvent(event);

    startTransition(() => {
      setSnapshot((current) => (current ? mergeSnapshot(current, localEvents, getEventOverrides()) : current));
      setError("");
    });

    if (typeof navigator !== "undefined" && navigator.onLine) {
      try {
        await fetchJson<{ ok: boolean }>("/api/events", {
          method: "POST",
          body: JSON.stringify(draft),
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
      setSnapshot((current) => (current ? mergeSnapshot(current, localEvents, getEventOverrides()) : current));
      setError("");
    });

    if (typeof navigator !== "undefined" && navigator.onLine) {
      try {
        await fetchJson<{ ok: boolean }>("/api/events", {
          method: "PUT",
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
    setSnapshot((current) => (current ? upsertSnapshotEvent(current, event) : current));
  };

  const downloadExport = useEffectEvent(async (format: "pdf" | "csv") => {
    const response = await fetch(`/api/exports?format=${format}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = format === "pdf" ? "care-summary.pdf" : "care-summary.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  });

  return {
    snapshot,
    activeActor,
    loading,
    syncing,
    pendingCount,
    online,
    aiAnswer,
    error,
    changeActor,
    addEvent,
    editEvent,
    replaceSnapshotEvent,
    refreshSnapshot,
    refreshAi,
    downloadExport,
  };
}

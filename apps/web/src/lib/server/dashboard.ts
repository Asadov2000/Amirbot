import { createHash } from "node:crypto";

import { CareEventRepository, prisma } from "@amir/db";

import { buildSnapshotFromEvents, createBaseSnapshot, createEventRecord } from "../mock-data";
import type { ActorId, CareEventRecord, DashboardSnapshot, EventDraft } from "../types";
import { ensureDefaultFamilyContext, type DefaultFamilyContext } from "./family-context";

const careEventRepository = new CareEventRepository(prisma);
const isProduction = process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";

interface DashboardCreateInput {
  familyId: string;
  childId: string;
  createdByUserId: string;
  source: "MANUAL";
  idempotencyKey: string;
  occurredAt: Date;
  payload: Record<string, string | number | boolean | null>;
  type:
    | "BREASTFEEDING"
    | "BOTTLE_FEEDING"
    | "SLEEP"
    | "DIAPER"
    | "TEMPERATURE"
    | "MEDICATION"
    | "NOTE";
  note?: string;
  startedAt?: Date;
  endedAt?: Date;
  breastSide?: "LEFT" | "RIGHT" | "BOTH";
  feedingSource?: "BREAST_MILK" | "FORMULA" | "WATER" | "SOLIDS" | "OTHER";
  quantityMl?: number;
  durationSeconds?: number;
  diaperKind?: "WET" | "DIRTY" | "MIXED" | "DRY_CHECK";
  temperatureC?: number;
  temperatureMethod?: "AXILLARY" | "ORAL" | "RECTAL" | "EAR" | "FOREHEAD" | "OTHER";
  medicationName?: string;
  medicationDose?: number;
  medicationUnit?: string;
  medicationRoute?: "ORAL" | "TOPICAL" | "NASAL" | "INHALATION" | "INJECTION" | "RECTAL" | "OTHER";
  reminderId?: string;
  medicationScheduleId?: string;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === "object" && value && "toString" in value) {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getPayloadRecord(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {} as Record<string, string | number | boolean | null>;
  }

  return payload as Record<string, string | number | boolean | null>;
}

function resolveActor(userId: string, context: DefaultFamilyContext): ActorId {
  return userId === context.actors.dad.userId ? "dad" : "mom";
}

function resolveSleepPhase(
  payload: Record<string, string | number | boolean | null>,
  event: { startedAt: Date | null; endedAt: Date | null },
) {
  const payloadPhase = payload.phase;

  if (payloadPhase === "END") {
    return "END";
  }

  if (payloadPhase === "START") {
    return "START";
  }

  if (event.startedAt && !event.endedAt) {
    return "START";
  }

  return "END";
}

function buildMedicationSummary(event: {
  medicationName: string | null;
  medicationDose: unknown;
  medicationUnit: string | null;
  note: string | null;
}) {
  if (event.note?.trim()) {
    return event.note;
  }

  const medicationName = event.medicationName?.trim() || "Лекарство";
  const dose = toNumber(event.medicationDose);
  const unit = event.medicationUnit?.trim();

  if (dose !== null) {
    return `${medicationName} — ${dose}${unit ? ` ${unit}` : ""}`;
  }

  return medicationName;
}

function toDashboardEventRecord(
  event: Awaited<ReturnType<typeof prisma.careEvent.findFirstOrThrow>>,
  context: DefaultFamilyContext,
): CareEventRecord {
  const payload = getPayloadRecord(event.payload);
  const actor = resolveActor(event.createdByUserId, context);

  switch (event.type) {
    case "BREASTFEEDING": {
      const durationMinutes = Math.max(1, Math.round((event.durationSeconds ?? 0) / 60) || 1);

      return {
        id: event.id,
        idempotencyKey: event.idempotencyKey,
        kind: "FEEDING",
        actor,
        occurredAt: event.occurredAt.toISOString(),
        summary: event.note?.trim() || `Грудь — ${durationMinutes} мин`,
        payload: {
          mode: "BREAST",
          durationMinutes,
        },
        status: "COMPLETED",
        editedAt: event.revision > 1 ? event.updatedAt.toISOString() : undefined,
        source: "server",
      };
    }
    case "BOTTLE_FEEDING": {
      const volumeMl = event.quantityMl ?? 0;

      return {
        id: event.id,
        idempotencyKey: event.idempotencyKey,
        kind: "FEEDING",
        actor,
        occurredAt: event.occurredAt.toISOString(),
        summary: event.note?.trim() || `Бутылочка — ${volumeMl} мл`,
        payload: {
          mode: "BOTTLE",
          volumeMl,
        },
        status: "COMPLETED",
        editedAt: event.revision > 1 ? event.updatedAt.toISOString() : undefined,
        source: "server",
      };
    }
    case "SLEEP": {
      const phase = resolveSleepPhase(payload, event);

      return {
        id: event.id,
        idempotencyKey: event.idempotencyKey,
        kind: "SLEEP",
        actor,
        occurredAt: event.occurredAt.toISOString(),
        summary: event.note?.trim() || (phase === "END" ? "Проснулся" : "Сон начался"),
        payload: {
          phase,
        },
        status: phase === "END" ? "COMPLETED" : "STARTED",
        editedAt: event.revision > 1 ? event.updatedAt.toISOString() : undefined,
        source: "server",
      };
    }
    case "DIAPER": {
      const diaperKind = event.diaperKind === "DIRTY" ? "DIRTY" : event.diaperKind === "MIXED" ? "MIXED" : "WET";

      return {
        id: event.id,
        idempotencyKey: event.idempotencyKey,
        kind: "DIAPER",
        actor,
        occurredAt: event.occurredAt.toISOString(),
        summary:
          event.note?.trim() ||
          (diaperKind === "DIRTY"
            ? "Подгузник — покакал"
            : diaperKind === "MIXED"
              ? "Подгузник — пописал и покакал"
              : "Подгузник — пописал"),
        payload: {
          type: diaperKind,
        },
        status: "LOGGED",
        editedAt: event.revision > 1 ? event.updatedAt.toISOString() : undefined,
        source: "server",
      };
    }
    case "TEMPERATURE": {
      const temperatureC = toNumber(event.temperatureC) ?? 36.6;

      return {
        id: event.id,
        idempotencyKey: event.idempotencyKey,
        kind: "TEMPERATURE",
        actor,
        occurredAt: event.occurredAt.toISOString(),
        summary: event.note?.trim() || `Температура ${temperatureC.toFixed(1)}°C`,
        payload: {
          temperatureC,
        },
        status: "LOGGED",
        editedAt: event.revision > 1 ? event.updatedAt.toISOString() : undefined,
        source: "server",
      };
    }
    case "MEDICATION": {
      const dose = toNumber(event.medicationDose);

      return {
        id: event.id,
        idempotencyKey: event.idempotencyKey,
        kind: "MEDICATION",
        actor,
        occurredAt: event.occurredAt.toISOString(),
        summary: buildMedicationSummary(event),
        payload: {
          medication: event.medicationName ?? "Лекарство",
          dose:
            dose === null
              ? event.medicationUnit ?? "без дозы"
              : `${dose}${event.medicationUnit ? ` ${event.medicationUnit}` : ""}`,
        },
        status: "COMPLETED",
        editedAt: event.revision > 1 ? event.updatedAt.toISOString() : undefined,
        source: "server",
      };
    }
    case "NOTE":
    default: {
      const dashboardKind =
        payload.dashboardKind === "SOLID_FOOD" || payload.dashboardKind === "GROWTH" ? payload.dashboardKind : null;

      if (dashboardKind) {
        return {
          id: event.id,
          idempotencyKey: event.idempotencyKey,
          kind: dashboardKind,
          actor,
          occurredAt: event.occurredAt.toISOString(),
          summary: event.note?.trim() || String(payload.note ?? "Запись"),
          payload,
          status: "LOGGED",
          editedAt: event.revision > 1 ? event.updatedAt.toISOString() : undefined,
          source: "server",
        };
      }

      return {
        id: event.id,
        idempotencyKey: event.idempotencyKey,
        kind: "NOTE",
        actor,
        occurredAt: event.occurredAt.toISOString(),
        summary: event.note?.trim() || "Заметка",
        payload: {
          ...payload,
          note: event.note?.trim() || "Заметка",
        },
        status: "LOGGED",
        editedAt: event.revision > 1 ? event.updatedAt.toISOString() : undefined,
        source: "server",
      };
    }
  }
}

function parseMedicationDose(rawValue: unknown) {
  const text = String(rawValue ?? "").trim();

  if (!text) {
    return { dose: undefined, unit: undefined };
  }

  const match = text.match(/(\d+(?:[.,]\d+)?)/);

  if (!match) {
    return { dose: undefined, unit: text };
  }

  const parsedDose = Number(match[1].replace(",", "."));
  const unit = text.replace(match[0], "").trim() || undefined;

  return {
    dose: Number.isFinite(parsedDose) ? parsedDose : undefined,
    unit,
  };
}

function buildIdempotencyKey(
  context: DefaultFamilyContext,
  draft: EventDraft,
  seed?: string,
) {
  const raw = seed
    ? seed
    : JSON.stringify({
        familyId: context.familyId,
        childId: context.childId,
        actor: draft.actor,
        kind: draft.kind,
        occurredAt: draft.occurredAt,
        summary: draft.summary,
        payload: draft.payload,
      });

  return createHash("sha256").update(raw).digest("hex");
}

function toCreateInput(
  draft: EventDraft,
  context: DefaultFamilyContext,
  actor: ActorId = draft.actor,
  seed?: string,
): DashboardCreateInput {
  const actorUserId = context.actors[actor].userId;
  const occurredAt = new Date(draft.occurredAt);
  const normalizedDraft = {
    ...draft,
    actor,
  };
  const baseInput = {
    familyId: context.familyId,
    childId: context.childId,
    createdByUserId: actorUserId,
    source: "MANUAL" as const,
    idempotencyKey: buildIdempotencyKey(context, normalizedDraft, seed),
    occurredAt,
    payload: draft.payload,
  };

  switch (draft.kind) {
    case "FEEDING":
      if (draft.payload.mode === "BOTTLE") {
        return {
          ...baseInput,
          type: "BOTTLE_FEEDING" as const,
          quantityMl: toNumber(draft.payload.volumeMl) ?? 0,
          note: draft.summary,
        };
      }

      return {
        ...baseInput,
        type: "BREASTFEEDING" as const,
        breastSide: "BOTH" as const,
        durationSeconds: Math.max(60, Math.round((toNumber(draft.payload.durationMinutes) ?? 0) * 60)),
        note: draft.summary,
      };
    case "SLEEP": {
      const phase = draft.payload.phase === "END" ? "END" : "START";

      return {
        ...baseInput,
        type: "SLEEP" as const,
        startedAt: phase === "START" ? occurredAt : undefined,
        endedAt: phase === "END" ? occurredAt : undefined,
        note: draft.summary,
        payload: {
          ...draft.payload,
          phase,
        },
      };
    }
    case "DIAPER":
      return {
        ...baseInput,
        type: "DIAPER" as const,
        diaperKind:
          draft.payload.type === "DIRTY"
            ? ("DIRTY" as const)
            : draft.payload.type === "MIXED"
              ? ("MIXED" as const)
              : ("WET" as const),
        note: draft.summary,
      };
    case "TEMPERATURE":
      return {
        ...baseInput,
        type: "TEMPERATURE" as const,
        temperatureC: toNumber(draft.payload.temperatureC) ?? 36.6,
        note: draft.summary,
      };
    case "MEDICATION": {
      const medicationName = String(draft.payload.medication ?? "Лекарство").trim() || "Лекарство";
      const medicationDose = parseMedicationDose(draft.payload.dose);

      return {
        ...baseInput,
        type: "MEDICATION" as const,
        medicationName,
        medicationDose: medicationDose.dose,
        medicationUnit: medicationDose.unit,
        note: draft.summary,
      };
    }
    case "SOLID_FOOD":
      return {
        ...baseInput,
        type: "NOTE" as const,
        note: draft.summary,
        payload: {
          ...draft.payload,
          dashboardKind: "SOLID_FOOD",
        },
      };
    case "GROWTH":
      return {
        ...baseInput,
        type: "NOTE" as const,
        note: draft.summary,
        payload: {
          ...draft.payload,
          dashboardKind: "GROWTH",
        },
      };
    case "NOTE":
    default:
      return {
        ...baseInput,
        type: "NOTE" as const,
        note: String(draft.payload.note ?? draft.summary).trim() || "Заметка",
      };
  }
}

function toUpdateInput(
  id: string,
  draft: EventDraft,
  context: DefaultFamilyContext,
  updatedByActor: ActorId,
) {
  const createInput = toCreateInput(draft, context, draft.actor, `update:${id}`);

  return {
    id,
    familyId: context.familyId,
    updatedByUserId: context.actors[updatedByActor].userId,
    occurredAt: createInput.occurredAt,
    startedAt: createInput.startedAt ?? null,
    endedAt: createInput.endedAt ?? null,
    note: createInput.note ?? null,
    payload: createInput.payload ?? null,
    breastSide: createInput.breastSide ?? null,
    feedingSource: createInput.feedingSource ?? null,
    quantityMl: createInput.quantityMl ?? null,
    durationSeconds: createInput.durationSeconds ?? null,
    diaperKind: createInput.diaperKind ?? null,
    temperatureC: createInput.temperatureC ?? null,
    temperatureMethod: createInput.temperatureMethod ?? null,
    medicationName: createInput.medicationName ?? null,
    medicationDose: createInput.medicationDose ?? null,
    medicationUnit: createInput.medicationUnit ?? null,
    medicationRoute: createInput.medicationRoute ?? null,
    reminderId: createInput.reminderId ?? null,
    medicationScheduleId: createInput.medicationScheduleId ?? null,
  };
}

function logServerFallback(message: string, error: unknown) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      app: "@amir/web",
      message,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  try {
    const context = await ensureDefaultFamilyContext();
    const events = await prisma.careEvent.findMany({
      where: {
        familyId: context.familyId,
        childId: context.childId,
        deletedAt: null,
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    });

    return buildSnapshotFromEvents(
      events.map((event) => toDashboardEventRecord(event, context)),
      {
        id: context.childId,
        name: context.childName,
        birthDate: context.childBirthDate,
      },
    );
  } catch (error) {
    logServerFallback("Falling back to mock dashboard snapshot", error);
    if (isProduction) {
      throw error;
    }
    return createBaseSnapshot();
  }
}

export async function createDashboardEvent(draft: EventDraft, actor: ActorId = draft.actor): Promise<CareEventRecord> {
  try {
    const context = await ensureDefaultFamilyContext();
    const created = await careEventRepository.create(toCreateInput(draft, context, actor));
    return toDashboardEventRecord(created, context);
  } catch (error) {
    logServerFallback("Falling back to mock event creation", error);
    if (isProduction) {
      throw error;
    }
    return createEventRecord(draft, "server");
  }
}

export async function updateDashboardEvent(
  id: string,
  draft: EventDraft,
  updatedByActor: ActorId = draft.actor,
): Promise<CareEventRecord> {
  try {
    const context = await ensureDefaultFamilyContext();
    const current = await prisma.careEvent.findFirst({
      where: {
        id,
        familyId: context.familyId,
        childId: context.childId,
        deletedAt: null,
      },
    });

    if (!current) {
      throw new Error("CareEvent not found for update");
    }

    const currentActor = resolveActor(current.createdByUserId, context);
    const nextCreateInput = toCreateInput(draft, context, currentActor, `replace:${id}:${current.revision + 1}`);
    const typeChanged = current.type !== nextCreateInput.type;

    if (typeChanged) {
      await careEventRepository.softDelete({
        id: current.id,
        familyId: context.familyId,
        deletedByUserId: context.actors[updatedByActor].userId,
        reason: "type-changed",
      });

      const recreated = await careEventRepository.create(nextCreateInput);
      return toDashboardEventRecord(recreated, context);
    }

    const updated = await careEventRepository.update(
      toUpdateInput(id, { ...draft, actor: currentActor }, context, updatedByActor),
    );
    return toDashboardEventRecord(updated, context);
  } catch (error) {
    logServerFallback("Falling back to mock event update", error);
    if (isProduction) {
      throw error;
    }
    return {
      ...createEventRecord(draft, "server"),
      id,
      editedAt: new Date().toISOString(),
    };
  }
}

import { Prisma, type CareEvent, type PrismaClient } from "@prisma/client";

import {
  careEventFeedQuerySchema,
  createCareEventInputSchema,
  updateCareEventInputSchema,
  type CareEventFeedQuery,
  type CareEventType,
  type CreateCareEventInput,
  type JsonValue,
  type UpdateCareEventInput
} from "@amir/shared";

import { writeAuditLog } from "../audit.js";
import { prisma } from "../client.js";
import { decimalToNumber, omitUndefined, toPrismaJsonValue } from "../utils.js";

function serializeCareEventSnapshot(event: CareEvent) {
  return {
    type: event.type,
    source: event.source,
    occurredAt: event.occurredAt.toISOString(),
    startedAt: event.startedAt?.toISOString() ?? null,
    endedAt: event.endedAt?.toISOString() ?? null,
    note: event.note ?? null,
    breastSide: event.breastSide ?? null,
    feedingSource: event.feedingSource ?? null,
    quantityMl: event.quantityMl ?? null,
    durationSeconds: event.durationSeconds ?? null,
    diaperKind: event.diaperKind ?? null,
    temperatureC: decimalToNumber(event.temperatureC),
    temperatureMethod: event.temperatureMethod ?? null,
    medicationName: event.medicationName ?? null,
    medicationDose: decimalToNumber(event.medicationDose),
    medicationUnit: event.medicationUnit ?? null,
    medicationRoute: event.medicationRoute ?? null,
    reminderId: event.reminderId ?? null,
    medicationScheduleId: event.medicationScheduleId ?? null,
    revision: event.revision,
    deletedAt: event.deletedAt?.toISOString() ?? null
  };
}

export interface CareEventDeleteInput {
  id: string;
  familyId: string;
  deletedByUserId: string;
  reason?: string | null;
}

export interface LatestCareEventQuery {
  familyId: string;
  childId: string;
  types: CareEventType[];
}

export interface CareEventFeedResult {
  items: CareEvent[];
  nextCursor: string | null;
}

export class CareEventRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async create(input: CreateCareEventInput) {
    const payload = createCareEventInputSchema.parse(input);

    return this.db.$transaction(async (tx) => {
      const existing = await tx.careEvent.findUnique({
        where: {
          familyId_idempotencyKey: {
            familyId: payload.familyId,
            idempotencyKey: payload.idempotencyKey
          }
        }
      });

      if (existing) {
        return existing;
      }

      const event = await tx.careEvent.create({
        data: {
          familyId: payload.familyId,
          childId: payload.childId,
          createdByUserId: payload.createdByUserId,
          type: payload.type,
          source: payload.source,
          idempotencyKey: payload.idempotencyKey,
          occurredAt: payload.occurredAt,
          startedAt: payload.startedAt ?? null,
          endedAt: payload.endedAt ?? null,
          note: payload.note ?? null,
          payload: toPrismaJsonValue(payload.payload),
          breastSide: payload.breastSide ?? null,
          feedingSource: payload.feedingSource ?? null,
          quantityMl: payload.quantityMl ?? null,
          durationSeconds: payload.durationSeconds ?? null,
          diaperKind: payload.diaperKind ?? null,
          temperatureC: payload.temperatureC ?? null,
          temperatureMethod: payload.temperatureMethod ?? null,
          medicationName: payload.medicationName ?? null,
          medicationDose: payload.medicationDose ?? null,
          medicationUnit: payload.medicationUnit ?? null,
          medicationRoute: payload.medicationRoute ?? null,
          reminderId: payload.reminderId ?? null,
          medicationScheduleId: payload.medicationScheduleId ?? null
        }
      });

      await writeAuditLog(tx, {
        familyId: event.familyId,
        childId: event.childId,
        actorUserId: event.createdByUserId,
        action: "CREATE",
        entityType: "CareEvent",
        entityId: event.id,
        changes: {
          after: serializeCareEventSnapshot(event)
        },
        metadata: {
          idempotencyKey: event.idempotencyKey
        }
      });

      return event;
    });
  }

  async update(input: UpdateCareEventInput) {
    const payload = updateCareEventInputSchema.parse(input);

    return this.db.$transaction(async (tx) => {
      const current = await tx.careEvent.findFirst({
        where: {
          id: payload.id,
          familyId: payload.familyId,
          deletedAt: null
        }
      });

      if (!current) {
        throw new Error("CareEvent not found");
      }

      const merged = createCareEventInputSchema.parse({
        familyId: current.familyId,
        childId: current.childId,
        createdByUserId: current.createdByUserId,
        type: current.type,
        source: current.source,
        idempotencyKey: current.idempotencyKey,
        occurredAt: payload.occurredAt ?? current.occurredAt,
        startedAt:
          payload.startedAt === undefined ? (current.startedAt ?? undefined) : (payload.startedAt ?? undefined),
        endedAt:
          payload.endedAt === undefined ? (current.endedAt ?? undefined) : (payload.endedAt ?? undefined),
        note: payload.note === undefined ? (current.note ?? undefined) : (payload.note ?? undefined),
        payload:
          payload.payload === undefined
            ? ((current.payload as Record<string, JsonValue> | null) ?? undefined)
            : (payload.payload ?? undefined),
        breastSide:
          payload.breastSide === undefined ? (current.breastSide ?? undefined) : (payload.breastSide ?? undefined),
        feedingSource:
          payload.feedingSource === undefined
            ? (current.feedingSource ?? undefined)
            : (payload.feedingSource ?? undefined),
        quantityMl: payload.quantityMl === undefined ? (current.quantityMl ?? undefined) : (payload.quantityMl ?? undefined),
        durationSeconds:
          payload.durationSeconds === undefined
            ? (current.durationSeconds ?? undefined)
            : (payload.durationSeconds ?? undefined),
        diaperKind:
          payload.diaperKind === undefined ? (current.diaperKind ?? undefined) : (payload.diaperKind ?? undefined),
        temperatureC:
          payload.temperatureC === undefined
            ? (decimalToNumber(current.temperatureC) ?? undefined)
            : (payload.temperatureC ?? undefined),
        temperatureMethod:
          payload.temperatureMethod === undefined
            ? (current.temperatureMethod ?? undefined)
            : (payload.temperatureMethod ?? undefined),
        medicationName:
          payload.medicationName === undefined
            ? (current.medicationName ?? undefined)
            : (payload.medicationName ?? undefined),
        medicationDose:
          payload.medicationDose === undefined
            ? (decimalToNumber(current.medicationDose) ?? undefined)
            : (payload.medicationDose ?? undefined),
        medicationUnit:
          payload.medicationUnit === undefined
            ? (current.medicationUnit ?? undefined)
            : (payload.medicationUnit ?? undefined),
        medicationRoute:
          payload.medicationRoute === undefined
            ? (current.medicationRoute ?? undefined)
            : (payload.medicationRoute ?? undefined),
        reminderId:
          payload.reminderId === undefined ? (current.reminderId ?? undefined) : (payload.reminderId ?? undefined),
        medicationScheduleId:
          payload.medicationScheduleId === undefined
            ? (current.medicationScheduleId ?? undefined)
            : (payload.medicationScheduleId ?? undefined)
      });

      const updated = await tx.careEvent.update({
        where: {
          id: current.id
        },
        data: {
          occurredAt: merged.occurredAt,
          startedAt: merged.startedAt ?? null,
          endedAt: merged.endedAt ?? null,
          note: merged.note ?? null,
          payload: toPrismaJsonValue(merged.payload),
          breastSide: merged.breastSide ?? null,
          feedingSource: merged.feedingSource ?? null,
          quantityMl: merged.quantityMl ?? null,
          durationSeconds: merged.durationSeconds ?? null,
          diaperKind: merged.diaperKind ?? null,
          temperatureC: merged.temperatureC ?? null,
          temperatureMethod: merged.temperatureMethod ?? null,
          medicationName: merged.medicationName ?? null,
          medicationDose: merged.medicationDose ?? null,
          medicationUnit: merged.medicationUnit ?? null,
          medicationRoute: merged.medicationRoute ?? null,
          reminderId: merged.reminderId ?? null,
          medicationScheduleId: merged.medicationScheduleId ?? null,
          updatedByUserId: payload.updatedByUserId,
          revision: {
            increment: 1
          }
        }
      });

      await writeAuditLog(tx, {
        familyId: updated.familyId,
        childId: updated.childId,
        actorUserId: payload.updatedByUserId,
        action: "UPDATE",
        entityType: "CareEvent",
        entityId: updated.id,
        changes: {
          before: serializeCareEventSnapshot(current),
          after: serializeCareEventSnapshot(updated)
        }
      });

      return updated;
    });
  }

  async softDelete(input: CareEventDeleteInput) {
    return this.db.$transaction(async (tx) => {
      const current = await tx.careEvent.findFirst({
        where: {
          id: input.id,
          familyId: input.familyId,
          deletedAt: null
        }
      });

      if (!current) {
        return null;
      }

      const deletedAt = new Date();
      const deleted = await tx.careEvent.update({
        where: { id: current.id },
        data: {
          deletedAt,
          updatedByUserId: input.deletedByUserId
        }
      });

      await writeAuditLog(tx, {
        familyId: deleted.familyId,
        childId: deleted.childId,
        actorUserId: input.deletedByUserId,
        action: "DELETE",
        entityType: "CareEvent",
        entityId: deleted.id,
        changes: {
          before: serializeCareEventSnapshot(current),
          after: serializeCareEventSnapshot(deleted)
        },
        metadata: omitUndefined({
          reason: input.reason ?? undefined
        })
      });

      return deleted;
    });
  }

  async listFeed(query: CareEventFeedQuery): Promise<CareEventFeedResult> {
    const payload = careEventFeedQuerySchema.parse(query);
    let cursorFilter: Prisma.CareEventWhereInput | undefined;

    if (payload.cursor) {
      const cursorEvent = await this.db.careEvent.findFirst({
        where: {
          id: payload.cursor,
          familyId: payload.familyId
        }
      });

      if (cursorEvent) {
        cursorFilter = {
          OR: [
            {
              occurredAt: {
                lt: cursorEvent.occurredAt
              }
            },
            {
              occurredAt: cursorEvent.occurredAt,
              createdAt: {
                lt: cursorEvent.createdAt
              }
            },
            {
              occurredAt: cursorEvent.occurredAt,
              createdAt: cursorEvent.createdAt,
              id: {
                lt: cursorEvent.id
              }
            }
          ]
        };
      }
    }

    const items = await this.db.careEvent.findMany({
      where: {
        familyId: payload.familyId,
        childId: payload.childId,
        type: payload.types ? { in: payload.types } : undefined,
        deletedAt: payload.includeDeleted ? undefined : null,
        ...cursorFilter
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: payload.limit + 1
    });

    const hasMore = items.length > payload.limit;
    const pageItems = hasMore ? items.slice(0, payload.limit) : items;

    return {
      items: pageItems,
      nextCursor: hasMore ? pageItems.at(-1)?.id ?? null : null
    };
  }

  async getLatestEvent(query: LatestCareEventQuery) {
    return this.db.careEvent.findFirst({
      where: {
        familyId: query.familyId,
        childId: query.childId,
        type: {
          in: query.types
        },
        deletedAt: null
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
    });
  }
}

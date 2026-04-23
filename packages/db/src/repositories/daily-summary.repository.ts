import { type CareEvent, type DailySummary, type PrismaClient } from "@prisma/client";

import {
  dailySummaryRequestSchema,
  getTimeZoneDayRange,
  type DailySummaryRequest,
  type JsonValue
} from "@amir/shared";

import { writeAuditLog } from "../audit.js";
import { prisma } from "../client.js";
import { decimalToNumber, toPrismaJsonValue } from "../utils.js";

function toDurationMinutes(event: CareEvent) {
  if (typeof event.durationSeconds === "number") {
    return Math.max(0, Math.round(event.durationSeconds / 60));
  }

  if (!event.startedAt || !event.endedAt) {
    return 0;
  }

  return Math.max(0, Math.round((event.endedAt.getTime() - event.startedAt.getTime()) / 60000));
}

function toSummaryDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function serializeEventTime(event: CareEvent | undefined) {
  if (!event) {
    return null;
  }

  return event.occurredAt.toISOString();
}

export interface DailySummaryAggregate {
  feedingsCount: number;
  breastfeedingCount: number;
  bottleFeedingsCount: number;
  totalBottleMl: number;
  sleepSessionsCount: number;
  totalSleepMinutes: number;
  averageFeedingIntervalMinutes: number | null;
  wetDiapersCount: number;
  dirtyDiapersCount: number;
  mixedDiapersCount: number;
  dryChecksCount: number;
  temperatureReadingsCount: number;
  maxTemperatureC: number | null;
  minTemperatureC: number | null;
  medicationsCount: number;
  notesCount: number;
  payload: Record<string, JsonValue>;
}

export function summarizeCareEvents(events: CareEvent[], timeZone: string): DailySummaryAggregate {
  const feedingEvents = events
    .filter((event) => event.type === "BREASTFEEDING" || event.type === "BOTTLE_FEEDING")
    .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());

  const sleepEvents = events.filter((event) => event.type === "SLEEP");
  const diaperEvents = events.filter((event) => event.type === "DIAPER");
  const temperatureValues = events
    .filter((event) => event.type === "TEMPERATURE")
    .map((event) => decimalToNumber(event.temperatureC))
    .filter((value): value is number => value !== null);

  const feedingIntervals = feedingEvents
    .slice(1)
    .map((event, index) =>
      Math.round((event.occurredAt.getTime() - feedingEvents[index]!.occurredAt.getTime()) / 60000)
    )
    .filter((value) => value >= 0);

  const bottleFeedings = feedingEvents.filter((event) => event.type === "BOTTLE_FEEDING");

  return {
    feedingsCount: feedingEvents.length,
    breastfeedingCount: feedingEvents.filter((event) => event.type === "BREASTFEEDING").length,
    bottleFeedingsCount: bottleFeedings.length,
    totalBottleMl: bottleFeedings.reduce((total, event) => total + (event.quantityMl ?? 0), 0),
    sleepSessionsCount: sleepEvents.length,
    totalSleepMinutes: sleepEvents.reduce((total, event) => total + toDurationMinutes(event), 0),
    averageFeedingIntervalMinutes:
      feedingIntervals.length === 0
        ? null
        : Math.round(feedingIntervals.reduce((total, value) => total + value, 0) / feedingIntervals.length),
    wetDiapersCount: diaperEvents.filter((event) => event.diaperKind === "WET").length,
    dirtyDiapersCount: diaperEvents.filter((event) => event.diaperKind === "DIRTY").length,
    mixedDiapersCount: diaperEvents.filter((event) => event.diaperKind === "MIXED").length,
    dryChecksCount: diaperEvents.filter((event) => event.diaperKind === "DRY_CHECK").length,
    temperatureReadingsCount: temperatureValues.length,
    maxTemperatureC: temperatureValues.length > 0 ? Math.max(...temperatureValues) : null,
    minTemperatureC: temperatureValues.length > 0 ? Math.min(...temperatureValues) : null,
    medicationsCount: events.filter((event) => event.type === "MEDICATION").length,
    notesCount: events.filter((event) => event.type === "NOTE").length,
    payload: {
      timeZone,
      eventCount: events.length,
      firstEventAt: serializeEventTime(events.at(0)),
      lastEventAt: serializeEventTime(events.at(-1)),
      lastFeedingAt: serializeEventTime(feedingEvents.at(-1)),
      lastSleepAt: serializeEventTime(sleepEvents.at(-1))
    }
  };
}

export interface DailySummaryRangeInput {
  familyId: string;
  childId: string;
  from: Date;
  to: Date;
  timeZone: string;
  actorUserId?: string | null;
}

export class DailySummaryRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async recomputeForDay(input: DailySummaryRequest & { actorUserId?: string | null }) {
    const payload = dailySummaryRequestSchema.parse(input);

    return this.db.$transaction(async (tx) => {
      const child = await tx.child.findFirst({
        where: {
          id: payload.childId,
          familyId: payload.familyId,
          deletedAt: null
        },
        select: {
          id: true
        }
      });

      if (!child) {
        throw new Error("Child not found");
      }

      const family = await tx.family.findFirst({
        where: {
          id: payload.familyId,
          deletedAt: null
        },
        select: {
          timeZone: true
        }
      });

      const timeZone = payload.timeZone ?? family?.timeZone ?? "UTC";
      const { dayKey, start, end } = getTimeZoneDayRange(payload.date, timeZone);
      const events = await tx.careEvent.findMany({
        where: {
          familyId: payload.familyId,
          childId: payload.childId,
          occurredAt: {
            gte: start,
            lt: end
          },
          deletedAt: null
        },
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }]
      });

      const summary = summarizeCareEvents(events, timeZone);
      const generatedAt = new Date();
      const summaryDate = toSummaryDate(dayKey);

      const result = await tx.dailySummary.upsert({
        where: {
          childId_summaryDate: {
            childId: payload.childId,
            summaryDate
          }
        },
        update: {
          familyId: payload.familyId,
          timeZone,
          ...summary,
          payload: toPrismaJsonValue(summary.payload),
          generatedAt,
          deletedAt: null
        },
        create: {
          familyId: payload.familyId,
          childId: payload.childId,
          summaryDate,
          timeZone,
          ...summary,
          payload: toPrismaJsonValue(summary.payload),
          generatedAt
        }
      });

      await writeAuditLog(tx, {
        familyId: payload.familyId,
        childId: payload.childId,
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorUserId ? "USER" : "WORKER",
        action: "GENERATE",
        entityType: "DailySummary",
        entityId: result.id,
        changes: {
          after: {
            summaryDate: dayKey,
            feedingsCount: result.feedingsCount,
            totalSleepMinutes: result.totalSleepMinutes,
            wetDiapersCount: result.wetDiapersCount,
            dirtyDiapersCount: result.dirtyDiapersCount
          }
        }
      });

      return result;
    });
  }

  async recomputeRange(input: DailySummaryRangeInput) {
    const results: DailySummary[] = [];
    const cursor = new Date(Date.UTC(input.from.getUTCFullYear(), input.from.getUTCMonth(), input.from.getUTCDate()));
    const limit = new Date(Date.UTC(input.to.getUTCFullYear(), input.to.getUTCMonth(), input.to.getUTCDate()));

    while (cursor <= limit) {
      results.push(
        await this.recomputeForDay({
          familyId: input.familyId,
          childId: input.childId,
          date: new Date(cursor),
          timeZone: input.timeZone,
          actorUserId: input.actorUserId
        })
      );

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return results;
  }

  async getByDate(input: DailySummaryRequest) {
    const payload = dailySummaryRequestSchema.parse(input);
    const timeZone = payload.timeZone ?? "UTC";
    const { dayKey } = getTimeZoneDayRange(payload.date, timeZone);

    return this.db.dailySummary.findFirst({
      where: {
        familyId: payload.familyId,
        childId: payload.childId,
        summaryDate: toSummaryDate(dayKey),
        deletedAt: null
      }
    });
  }
}

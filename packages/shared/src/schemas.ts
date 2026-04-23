import { z } from "zod";

import {
  auditActions,
  auditActorTypes,
  breastSides,
  careEventSources,
  careEventTypes,
  childSexes,
  diaperKinds,
  exportFormats,
  exportJobStatuses,
  exportScopes,
  familyMemberRoles,
  feedingSources,
  medicationRoutes,
  medicationScheduleStatuses,
  reminderStatuses,
  reminderTypes,
  temperatureMethods,
  userStatuses
} from "./enums.js";

type SchemaJsonValue =
  | string
  | number
  | boolean
  | null
  | SchemaJsonValue[]
  | { [key: string]: SchemaJsonValue };

const idSchema = z.string().trim().min(10).max(64);
const nonEmptyStringSchema = z.string().trim().min(1);
const optionalTrimmedStringSchema = z.string().trim().max(2000).optional();
const isoDateTimeSchema = z.string().datetime({ offset: true });
const dateSchema = z.coerce.date();
const jsonValueSchema: z.ZodType<SchemaJsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)])
);

const timeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    try {
      Intl.DateTimeFormat("ru-RU", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Ожидается корректная IANA timezone");

const careEventTypeSchema = z.enum(careEventTypes);
const careEventSourceSchema = z.enum(careEventSources);
const reminderTypeSchema = z.enum(reminderTypes);
const reminderStatusSchema = z.enum(reminderStatuses);
const medicationScheduleStatusSchema = z.enum(medicationScheduleStatuses);
const exportFormatSchema = z.enum(exportFormats);
const exportScopeSchema = z.enum(exportScopes);
const exportJobStatusSchema = z.enum(exportJobStatuses);
const auditActionSchema = z.enum(auditActions);
const auditActorTypeSchema = z.enum(auditActorTypes);

const careEventCreateShape = {
  familyId: idSchema,
  childId: idSchema,
  createdByUserId: idSchema,
  type: careEventTypeSchema,
  source: careEventSourceSchema.default("MANUAL"),
  idempotencyKey: nonEmptyStringSchema.max(128),
  occurredAt: dateSchema,
  startedAt: dateSchema.optional(),
  endedAt: dateSchema.optional(),
  note: optionalTrimmedStringSchema,
  payload: z.record(z.string(), jsonValueSchema).optional(),
  breastSide: z.enum(breastSides).optional(),
  feedingSource: z.enum(feedingSources).optional(),
  quantityMl: z.coerce.number().int().min(0).max(5000).optional(),
  durationSeconds: z.coerce.number().int().min(0).max(86400).optional(),
  diaperKind: z.enum(diaperKinds).optional(),
  temperatureC: z.coerce.number().min(30).max(45).optional(),
  temperatureMethod: z.enum(temperatureMethods).optional(),
  medicationName: z.string().trim().min(1).max(120).optional(),
  medicationDose: z.coerce.number().positive().max(5000).optional(),
  medicationUnit: z.string().trim().min(1).max(32).optional(),
  medicationRoute: z.enum(medicationRoutes).optional(),
  reminderId: idSchema.optional(),
  medicationScheduleId: idSchema.optional()
} satisfies z.ZodRawShape;

const careEventUpdateShape = {
  id: idSchema,
  familyId: idSchema,
  updatedByUserId: idSchema,
  occurredAt: dateSchema.optional(),
  startedAt: dateSchema.nullish(),
  endedAt: dateSchema.nullish(),
  note: z.string().trim().max(2000).nullish(),
  payload: z.record(z.string(), jsonValueSchema).nullish(),
  breastSide: z.enum(breastSides).nullish(),
  feedingSource: z.enum(feedingSources).nullish(),
  quantityMl: z.coerce.number().int().min(0).max(5000).nullish(),
  durationSeconds: z.coerce.number().int().min(0).max(86400).nullish(),
  diaperKind: z.enum(diaperKinds).nullish(),
  temperatureC: z.coerce.number().min(30).max(45).nullish(),
  temperatureMethod: z.enum(temperatureMethods).nullish(),
  medicationName: z.string().trim().min(1).max(120).nullish(),
  medicationDose: z.coerce.number().positive().max(5000).nullish(),
  medicationUnit: z.string().trim().min(1).max(32).nullish(),
  medicationRoute: z.enum(medicationRoutes).nullish(),
  reminderId: idSchema.nullish(),
  medicationScheduleId: idSchema.nullish()
} satisfies z.ZodRawShape;

function validateCareEventPayload(
  value: {
    type: z.infer<typeof careEventTypeSchema>;
    note?: string | null | undefined;
    breastSide?: string | null | undefined;
    quantityMl?: number | null | undefined;
    durationSeconds?: number | null | undefined;
    diaperKind?: string | null | undefined;
    temperatureC?: number | null | undefined;
    medicationName?: string | null | undefined;
    startedAt?: Date | null | undefined;
    endedAt?: Date | null | undefined;
  },
  ctx: z.RefinementCtx
) {
  if (value.startedAt && value.endedAt && value.startedAt > value.endedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "startedAt не может быть позже endedAt",
      path: ["startedAt"]
    });
  }

  switch (value.type) {
    case "BREASTFEEDING":
      if (!value.breastSide && !value.durationSeconds && !value.startedAt && !value.endedAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Для грудного кормления нужно указать сторону, длительность или интервал",
          path: ["breastSide"]
        });
      }
      break;
    case "BOTTLE_FEEDING":
      if (!value.quantityMl) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Для бутылочки нужно указать объём в мл",
          path: ["quantityMl"]
        });
      }
      break;
    case "SLEEP":
      if (!value.durationSeconds && !value.startedAt && !value.endedAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Для сна нужно указать длительность или границы интервала",
          path: ["durationSeconds"]
        });
      }
      break;
    case "DIAPER":
      if (!value.diaperKind) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Для подгузника нужно указать тип",
          path: ["diaperKind"]
        });
      }
      break;
    case "TEMPERATURE":
      if (typeof value.temperatureC !== "number") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Для температуры нужно указать значение",
          path: ["temperatureC"]
        });
      }
      break;
    case "MEDICATION":
      if (!value.medicationName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Для лекарства нужно указать название",
          path: ["medicationName"]
        });
      }
      break;
    case "NOTE":
      if (!value.note) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Для заметки нужен текст",
          path: ["note"]
        });
      }
      break;
    default:
      break;
  }
}

export const userDtoSchema = z.object({
  id: idSchema,
  telegramUserId: z.string().trim().regex(/^\d{5,20}$/).nullable(),
  firstName: nonEmptyStringSchema.max(120),
  lastName: z.string().trim().max(120).nullable(),
  displayName: nonEmptyStringSchema.max(160),
  locale: nonEmptyStringSchema.max(16),
  timeZone: timeZoneSchema,
  status: z.enum(userStatuses),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable()
});

export const familyDtoSchema = z.object({
  id: idSchema,
  name: nonEmptyStringSchema.max(120),
  timeZone: timeZoneSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable()
});

export const familyMemberDtoSchema = z.object({
  id: idSchema,
  familyId: idSchema,
  userId: idSchema,
  role: z.enum(familyMemberRoles),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable()
});

export const childDtoSchema = z.object({
  id: idSchema,
  familyId: idSchema,
  name: nonEmptyStringSchema.max(120),
  birthDate: isoDateTimeSchema,
  sex: z.enum(childSexes),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable()
});

export const careEventDtoSchema = z.object({
  id: idSchema,
  familyId: idSchema,
  childId: idSchema,
  createdByUserId: idSchema,
  updatedByUserId: idSchema.nullable(),
  type: careEventTypeSchema,
  source: careEventSourceSchema,
  idempotencyKey: nonEmptyStringSchema.max(128),
  occurredAt: isoDateTimeSchema,
  startedAt: isoDateTimeSchema.nullable(),
  endedAt: isoDateTimeSchema.nullable(),
  note: z.string().nullable(),
  payload: z.record(z.string(), jsonValueSchema).nullable(),
  breastSide: z.enum(breastSides).nullable(),
  feedingSource: z.enum(feedingSources).nullable(),
  quantityMl: z.number().int().nonnegative().nullable(),
  durationSeconds: z.number().int().nonnegative().nullable(),
  diaperKind: z.enum(diaperKinds).nullable(),
  temperatureC: z.number().nullable(),
  temperatureMethod: z.enum(temperatureMethods).nullable(),
  medicationName: z.string().nullable(),
  medicationDose: z.number().nullable(),
  medicationUnit: z.string().nullable(),
  medicationRoute: z.enum(medicationRoutes).nullable(),
  reminderId: idSchema.nullable(),
  medicationScheduleId: idSchema.nullable(),
  revision: z.number().int().positive(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable()
});

export const createCareEventInputSchema = z
  .object(careEventCreateShape)
  .superRefine((value, ctx) => validateCareEventPayload(value, ctx));

export const updateCareEventInputSchema = z
  .object(careEventUpdateShape)
  .superRefine((value, ctx) => {
    if (value.startedAt && value.endedAt && value.startedAt > value.endedAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "startedAt не может быть позже endedAt",
        path: ["startedAt"]
      });
    }
  });

export const careEventFeedQuerySchema = z.object({
  familyId: idSchema,
  childId: idSchema.optional(),
  types: z.array(careEventTypeSchema).min(1).max(7).optional(),
  includeDeleted: z.coerce.boolean().default(false),
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30)
});

export const reminderDtoSchema = z.object({
  id: idSchema,
  familyId: idSchema,
  childId: idSchema.nullable(),
  createdByUserId: idSchema,
  type: reminderTypeSchema,
  status: reminderStatusSchema,
  title: nonEmptyStringSchema.max(120),
  message: z.string().max(1000).nullable(),
  dueAt: isoDateTimeSchema,
  nextTriggerAt: isoDateTimeSchema.nullable(),
  repeatEveryMinutes: z.number().int().positive().nullable(),
  timeZone: timeZoneSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable()
});

export const createReminderInputSchema = z.object({
  familyId: idSchema,
  childId: idSchema.optional(),
  createdByUserId: idSchema,
  type: reminderTypeSchema,
  title: nonEmptyStringSchema.max(120),
  message: z.string().trim().max(1000).optional(),
  dueAt: dateSchema,
  repeatEveryMinutes: z.coerce.number().int().positive().max(10080).optional(),
  timeZone: timeZoneSchema
});

export const medicationScheduleDtoSchema = z.object({
  id: idSchema,
  familyId: idSchema,
  childId: idSchema,
  createdByUserId: idSchema,
  status: medicationScheduleStatusSchema,
  medicationName: nonEmptyStringSchema.max(120),
  dose: z.number().positive(),
  doseUnit: nonEmptyStringSchema.max(32),
  route: z.enum(medicationRoutes),
  frequencyMinutes: z.number().int().positive(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.nullable(),
  nextDoseAt: isoDateTimeSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable()
});

export const dailySummaryDtoSchema = z.object({
  id: idSchema,
  familyId: idSchema,
  childId: idSchema,
  summaryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeZone: timeZoneSchema,
  feedingsCount: z.number().int().nonnegative(),
  breastfeedingCount: z.number().int().nonnegative(),
  bottleFeedingsCount: z.number().int().nonnegative(),
  totalBottleMl: z.number().int().nonnegative(),
  sleepSessionsCount: z.number().int().nonnegative(),
  totalSleepMinutes: z.number().int().nonnegative(),
  averageFeedingIntervalMinutes: z.number().int().nonnegative().nullable(),
  wetDiapersCount: z.number().int().nonnegative(),
  dirtyDiapersCount: z.number().int().nonnegative(),
  mixedDiapersCount: z.number().int().nonnegative(),
  dryChecksCount: z.number().int().nonnegative(),
  temperatureReadingsCount: z.number().int().nonnegative(),
  maxTemperatureC: z.number().nullable(),
  minTemperatureC: z.number().nullable(),
  medicationsCount: z.number().int().nonnegative(),
  notesCount: z.number().int().nonnegative(),
  payload: z.record(z.string(), jsonValueSchema).nullable(),
  generatedAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable()
});

export const dailySummaryRequestSchema = z.object({
  familyId: idSchema,
  childId: idSchema,
  date: dateSchema,
  timeZone: timeZoneSchema.optional()
});

export const exportJobDtoSchema = z.object({
  id: idSchema,
  familyId: idSchema,
  childId: idSchema.nullable(),
  requestedByUserId: idSchema,
  format: exportFormatSchema,
  scope: exportScopeSchema,
  status: exportJobStatusSchema,
  rangeStart: isoDateTimeSchema,
  rangeEnd: isoDateTimeSchema,
  fileName: z.string().nullable(),
  fileUrl: z.string().url().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable()
});

export const createExportJobInputSchema = z.object({
  familyId: idSchema,
  childId: idSchema.optional(),
  requestedByUserId: idSchema,
  format: exportFormatSchema,
  scope: exportScopeSchema,
  rangeStart: dateSchema,
  rangeEnd: dateSchema
});

export const auditLogDtoSchema = z.object({
  id: idSchema,
  familyId: idSchema.nullable(),
  childId: idSchema.nullable(),
  actorUserId: idSchema.nullable(),
  actorType: auditActorTypeSchema,
  action: auditActionSchema,
  entityType: nonEmptyStringSchema.max(64),
  entityId: nonEmptyStringSchema.max(64),
  changes: z.record(z.string(), jsonValueSchema).nullable(),
  metadata: z.record(z.string(), jsonValueSchema).nullable(),
  createdAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable()
});

export {
  auditActionSchema,
  auditActorTypeSchema,
  careEventSourceSchema,
  careEventTypeSchema,
  dateSchema,
  exportFormatSchema,
  exportJobStatusSchema,
  exportScopeSchema,
  idSchema,
  isoDateTimeSchema,
  jsonValueSchema,
  medicationScheduleStatusSchema,
  reminderStatusSchema,
  reminderTypeSchema,
  timeZoneSchema
};

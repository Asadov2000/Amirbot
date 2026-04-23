import type { z } from "zod";

import type {
  auditLogDtoSchema,
  careEventDtoSchema,
  careEventFeedQuerySchema,
  childDtoSchema,
  createCareEventInputSchema,
  createExportJobInputSchema,
  createReminderInputSchema,
  dailySummaryDtoSchema,
  dailySummaryRequestSchema,
  exportJobDtoSchema,
  familyDtoSchema,
  familyMemberDtoSchema,
  medicationScheduleDtoSchema,
  reminderDtoSchema,
  updateCareEventInputSchema,
  userDtoSchema
} from "./schemas.js";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type UserDto = z.infer<typeof userDtoSchema>;
export type FamilyDto = z.infer<typeof familyDtoSchema>;
export type FamilyMemberDto = z.infer<typeof familyMemberDtoSchema>;
export type ChildDto = z.infer<typeof childDtoSchema>;
export type CareEventDto = z.infer<typeof careEventDtoSchema>;
export type CreateCareEventInput = z.infer<typeof createCareEventInputSchema>;
export type UpdateCareEventInput = z.infer<typeof updateCareEventInputSchema>;
export type CareEventFeedQuery = z.infer<typeof careEventFeedQuerySchema>;
export type ReminderDto = z.infer<typeof reminderDtoSchema>;
export type CreateReminderInput = z.infer<typeof createReminderInputSchema>;
export type MedicationScheduleDto = z.infer<typeof medicationScheduleDtoSchema>;
export type DailySummaryDto = z.infer<typeof dailySummaryDtoSchema>;
export type DailySummaryRequest = z.infer<typeof dailySummaryRequestSchema>;
export type ExportJobDto = z.infer<typeof exportJobDtoSchema>;
export type CreateExportJobInput = z.infer<typeof createExportJobInputSchema>;
export type AuditLogDto = z.infer<typeof auditLogDtoSchema>;

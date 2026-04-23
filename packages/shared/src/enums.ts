export const userRoles = ["OWNER", "PARTNER", "CAREGIVER"] as const;
export const userStatuses = ["ACTIVE", "INVITED", "DISABLED"] as const;
export const childSexes = ["MALE", "FEMALE", "INTERSEX", "UNSPECIFIED"] as const;
export const familyMemberRoles = ["OWNER", "PARTNER", "CAREGIVER"] as const;

export const careEventTypes = [
  "BREASTFEEDING",
  "BOTTLE_FEEDING",
  "SLEEP",
  "DIAPER",
  "TEMPERATURE",
  "MEDICATION",
  "NOTE"
] as const;

export const careEventSources = [
  "MANUAL",
  "OFFLINE_SYNC",
  "BOT",
  "SYSTEM",
  "IMPORT"
] as const;

export const breastSides = ["LEFT", "RIGHT", "BOTH"] as const;
export const feedingSources = [
  "BREAST_MILK",
  "FORMULA",
  "WATER",
  "SOLIDS",
  "OTHER"
] as const;
export const diaperKinds = ["WET", "DIRTY", "MIXED", "DRY_CHECK"] as const;
export const temperatureMethods = [
  "AXILLARY",
  "ORAL",
  "RECTAL",
  "EAR",
  "FOREHEAD",
  "OTHER"
] as const;

export const medicationRoutes = [
  "ORAL",
  "TOPICAL",
  "NASAL",
  "INHALATION",
  "INJECTION",
  "RECTAL",
  "OTHER"
] as const;

export const reminderTypes = [
  "FEEDING",
  "SLEEP",
  "DIAPER",
  "MEDICATION",
  "TEMPERATURE",
  "CUSTOM"
] as const;

export const reminderStatuses = ["ACTIVE", "PAUSED", "DONE", "CANCELLED"] as const;
export const medicationScheduleStatuses = [
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED"
] as const;

export const exportFormats = ["PDF", "CSV"] as const;
export const exportScopes = ["DAILY", "WEEKLY", "CUSTOM"] as const;
export const exportJobStatuses = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED"
] as const;

export const auditActions = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "RESTORE",
  "GENERATE",
  "SYNC",
  "SEND",
  "COMPLETE",
  "FAIL"
] as const;

export const auditActorTypes = ["USER", "SYSTEM", "WORKER", "BOT"] as const;

export type UserRole = (typeof userRoles)[number];
export type UserStatus = (typeof userStatuses)[number];
export type ChildSex = (typeof childSexes)[number];
export type FamilyMemberRole = (typeof familyMemberRoles)[number];
export type CareEventType = (typeof careEventTypes)[number];
export type CareEventSource = (typeof careEventSources)[number];
export type BreastSide = (typeof breastSides)[number];
export type FeedingSource = (typeof feedingSources)[number];
export type DiaperKind = (typeof diaperKinds)[number];
export type TemperatureMethod = (typeof temperatureMethods)[number];
export type MedicationRoute = (typeof medicationRoutes)[number];
export type ReminderType = (typeof reminderTypes)[number];
export type ReminderStatus = (typeof reminderStatuses)[number];
export type MedicationScheduleStatus = (typeof medicationScheduleStatuses)[number];
export type ExportFormat = (typeof exportFormats)[number];
export type ExportScope = (typeof exportScopes)[number];
export type ExportJobStatus = (typeof exportJobStatuses)[number];
export type AuditAction = (typeof auditActions)[number];
export type AuditActorType = (typeof auditActorTypes)[number];

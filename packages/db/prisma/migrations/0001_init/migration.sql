-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "FamilyMemberRole" AS ENUM ('OWNER', 'PARTNER', 'CAREGIVER');

-- CreateEnum
CREATE TYPE "ChildSex" AS ENUM ('MALE', 'FEMALE', 'INTERSEX', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "CareEventType" AS ENUM ('BREASTFEEDING', 'BOTTLE_FEEDING', 'SLEEP', 'DIAPER', 'TEMPERATURE', 'MEDICATION', 'NOTE');

-- CreateEnum
CREATE TYPE "CareEventSource" AS ENUM ('MANUAL', 'OFFLINE_SYNC', 'BOT', 'SYSTEM', 'IMPORT');

-- CreateEnum
CREATE TYPE "BreastSide" AS ENUM ('LEFT', 'RIGHT', 'BOTH');

-- CreateEnum
CREATE TYPE "FeedingSource" AS ENUM ('BREAST_MILK', 'FORMULA', 'WATER', 'SOLIDS', 'OTHER');

-- CreateEnum
CREATE TYPE "DiaperKind" AS ENUM ('WET', 'DIRTY', 'MIXED', 'DRY_CHECK');

-- CreateEnum
CREATE TYPE "TemperatureMethod" AS ENUM ('AXILLARY', 'ORAL', 'RECTAL', 'EAR', 'FOREHEAD', 'OTHER');

-- CreateEnum
CREATE TYPE "MedicationRoute" AS ENUM ('ORAL', 'TOPICAL', 'NASAL', 'INHALATION', 'INJECTION', 'RECTAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('FEEDING', 'SLEEP', 'DIAPER', 'MEDICATION', 'TEMPERATURE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MedicationScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('PDF', 'CSV');

-- CreateEnum
CREATE TYPE "ExportScope" AS ENUM ('DAILY', 'WEEKLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'GENERATE', 'SYNC', 'SEND', 'COMPLETE', 'FAIL');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'WORKER', 'BOT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "displayName" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ru-RU',
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "families" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FamilyMemberRole" NOT NULL DEFAULT 'PARTNER',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthDate" DATE NOT NULL,
    "sex" "ChildSex" NOT NULL DEFAULT 'UNSPECIFIED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_events" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "type" "CareEventType" NOT NULL,
    "source" "CareEventSource" NOT NULL DEFAULT 'MANUAL',
    "idempotencyKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "startedAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "note" TEXT,
    "payload" JSONB,
    "breastSide" "BreastSide",
    "feedingSource" "FeedingSource",
    "quantityMl" INTEGER,
    "durationSeconds" INTEGER,
    "diaperKind" "DiaperKind",
    "temperatureC" DECIMAL(4,1),
    "temperatureMethod" "TemperatureMethod",
    "medicationName" TEXT,
    "medicationDose" DECIMAL(10,2),
    "medicationUnit" TEXT,
    "medicationRoute" "MedicationRoute",
    "reminderId" TEXT,
    "medicationScheduleId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "care_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "message" TEXT,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "nextTriggerAt" TIMESTAMPTZ(3),
    "lastTriggeredAt" TIMESTAMPTZ(3),
    "repeatEveryMinutes" INTEGER,
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_schedules" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "MedicationScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "medicationName" TEXT NOT NULL,
    "dose" DECIMAL(10,2) NOT NULL,
    "doseUnit" TEXT NOT NULL,
    "route" "MedicationRoute" NOT NULL,
    "frequencyMinutes" INTEGER NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3),
    "nextDoseAt" TIMESTAMPTZ(3),
    "lastDoseAt" TIMESTAMPTZ(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "medication_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_summaries" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "summaryDate" DATE NOT NULL,
    "timeZone" TEXT NOT NULL,
    "feedingsCount" INTEGER NOT NULL DEFAULT 0,
    "breastfeedingCount" INTEGER NOT NULL DEFAULT 0,
    "bottleFeedingsCount" INTEGER NOT NULL DEFAULT 0,
    "totalBottleMl" INTEGER NOT NULL DEFAULT 0,
    "sleepSessionsCount" INTEGER NOT NULL DEFAULT 0,
    "totalSleepMinutes" INTEGER NOT NULL DEFAULT 0,
    "averageFeedingIntervalMinutes" INTEGER,
    "wetDiapersCount" INTEGER NOT NULL DEFAULT 0,
    "dirtyDiapersCount" INTEGER NOT NULL DEFAULT 0,
    "mixedDiapersCount" INTEGER NOT NULL DEFAULT 0,
    "dryChecksCount" INTEGER NOT NULL DEFAULT 0,
    "temperatureReadingsCount" INTEGER NOT NULL DEFAULT 0,
    "maxTemperatureC" DECIMAL(4,1),
    "minTemperatureC" DECIMAL(4,1),
    "medicationsCount" INTEGER NOT NULL DEFAULT 0,
    "notesCount" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "generatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "daily_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_jobs" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "childId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "scope" "ExportScope" NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'PENDING',
    "rangeStart" TIMESTAMPTZ(3) NOT NULL,
    "rangeEnd" TIMESTAMPTZ(3) NOT NULL,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "errorMessage" TEXT,
    "parameters" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "childId" TEXT,
    "actorUserId" TEXT,
    "actorType" "AuditActorType" NOT NULL DEFAULT 'USER',
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramUserId_key" ON "users"("telegramUserId");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "families_deletedAt_idx" ON "families"("deletedAt");

-- CreateIndex
CREATE INDEX "family_members_userId_deletedAt_idx" ON "family_members"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "family_members_familyId_deletedAt_idx" ON "family_members"("familyId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_familyId_userId_key" ON "family_members"("familyId", "userId");

-- CreateIndex
CREATE INDEX "children_familyId_deletedAt_idx" ON "children"("familyId", "deletedAt");

-- CreateIndex
CREATE INDEX "care_events_familyId_childId_occurredAt_idx" ON "care_events"("familyId", "childId", "occurredAt");

-- CreateIndex
CREATE INDEX "care_events_createdByUserId_deletedAt_idx" ON "care_events"("createdByUserId", "deletedAt");

-- CreateIndex
CREATE INDEX "care_events_reminderId_idx" ON "care_events"("reminderId");

-- CreateIndex
CREATE INDEX "care_events_medicationScheduleId_idx" ON "care_events"("medicationScheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "care_events_familyId_idempotencyKey_key" ON "care_events"("familyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "reminders_familyId_status_nextTriggerAt_idx" ON "reminders"("familyId", "status", "nextTriggerAt");

-- CreateIndex
CREATE INDEX "reminders_childId_deletedAt_idx" ON "reminders"("childId", "deletedAt");

-- CreateIndex
CREATE INDEX "medication_schedules_familyId_status_nextDoseAt_idx" ON "medication_schedules"("familyId", "status", "nextDoseAt");

-- CreateIndex
CREATE INDEX "medication_schedules_childId_deletedAt_idx" ON "medication_schedules"("childId", "deletedAt");

-- CreateIndex
CREATE INDEX "daily_summaries_familyId_summaryDate_idx" ON "daily_summaries"("familyId", "summaryDate");

-- CreateIndex
CREATE UNIQUE INDEX "daily_summaries_childId_summaryDate_key" ON "daily_summaries"("childId", "summaryDate");

-- CreateIndex
CREATE INDEX "export_jobs_familyId_status_createdAt_idx" ON "export_jobs"("familyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "export_jobs_childId_deletedAt_idx" ON "export_jobs"("childId", "deletedAt");

-- CreateIndex
CREATE INDEX "audit_logs_familyId_createdAt_idx" ON "audit_logs"("familyId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_childId_createdAt_idx" ON "audit_logs"("childId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_events" ADD CONSTRAINT "care_events_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_events" ADD CONSTRAINT "care_events_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_events" ADD CONSTRAINT "care_events_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_events" ADD CONSTRAINT "care_events_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_events" ADD CONSTRAINT "care_events_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "reminders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_events" ADD CONSTRAINT "care_events_medicationScheduleId_fkey" FOREIGN KEY ("medicationScheduleId") REFERENCES "medication_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_schedules" ADD CONSTRAINT "medication_schedules_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_schedules" ADD CONSTRAINT "medication_schedules_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_schedules" ADD CONSTRAINT "medication_schedules_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_childId_fkey" FOREIGN KEY ("childId") REFERENCES "children"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial indexes for hot paths with soft delete filtering.
CREATE INDEX "users_active_idx" ON "public"."users"("id") WHERE "deletedAt" IS NULL;
CREATE INDEX "children_family_active_idx" ON "public"."children"("familyId", "birthDate") WHERE "deletedAt" IS NULL;
CREATE INDEX "family_members_active_idx" ON "public"."family_members"("familyId", "userId") WHERE "deletedAt" IS NULL;
CREATE INDEX "care_events_active_feed_idx" ON "public"."care_events"("familyId", "childId", "occurredAt" DESC) WHERE "deletedAt" IS NULL;
CREATE INDEX "reminders_active_queue_idx" ON "public"."reminders"("familyId", "status", "nextTriggerAt") WHERE "deletedAt" IS NULL;
CREATE INDEX "medication_schedules_active_idx" ON "public"."medication_schedules"("familyId", "status", "nextDoseAt") WHERE "deletedAt" IS NULL;
CREATE INDEX "daily_summaries_active_idx" ON "public"."daily_summaries"("familyId", "summaryDate") WHERE "deletedAt" IS NULL;


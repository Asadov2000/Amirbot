import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { prisma, withDbRetry } from "@amir/db";

import {
  ApiError,
  readJsonBody,
  safeApiError,
} from "@/lib/server/api-security";

const RESET_CONFIRMATION = "RESET_AMIR_CARE_DATA";

function getAdminToken() {
  return (
    process.env.APP_ADMIN_TOKEN?.trim() ??
    process.env.APP_SESSION_SECRET?.trim() ??
    ""
  );
}

function assertAdminToken(request: Request) {
  const expectedToken = getAdminToken();
  const actualToken = request.headers.get("x-admin-token")?.trim() ?? "";

  if (!expectedToken || !actualToken) {
    throw new ApiError("Admin token is required", 403, "Доступ запрещен.");
  }

  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(actualToken);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new ApiError("Admin token is invalid", 403, "Доступ запрещен.");
  }
}

async function countCareData() {
  const [
    careEvents,
    reminders,
    medicationSchedules,
    dailySummaries,
    exportJobs,
    auditLogs,
    users,
    families,
    children,
  ] = await Promise.all([
    prisma.careEvent.count(),
    prisma.reminder.count(),
    prisma.medicationSchedule.count(),
    prisma.dailySummary.count(),
    prisma.exportJob.count(),
    prisma.auditLog.count(),
    prisma.user.count(),
    prisma.family.count(),
    prisma.child.count(),
  ]);

  return {
    careEvents,
    reminders,
    medicationSchedules,
    dailySummaries,
    exportJobs,
    auditLogs,
    users,
    families,
    children,
  };
}

export async function POST(request: Request) {
  try {
    assertAdminToken(request);
    const payload = await readJsonBody<{ confirm?: unknown }>(request);

    if (payload.confirm !== RESET_CONFIRMATION) {
      throw new ApiError(
        "Reset confirmation is invalid",
        400,
        "Неверное подтверждение очистки.",
      );
    }

    const result = await withDbRetry(async () => {
      const before = await countCareData();

      await prisma.$transaction([
        prisma.careEvent.deleteMany({}),
        prisma.reminder.deleteMany({}),
        prisma.medicationSchedule.deleteMany({}),
        prisma.dailySummary.deleteMany({}),
        prisma.exportJob.deleteMany({}),
        prisma.auditLog.deleteMany({}),
      ]);

      const after = await countCareData();

      return {
        ok: true,
        before,
        after,
        resetAt: new Date().toISOString(),
      };
    });

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return safeApiError(error, "Не удалось очистить тестовые данные.");
  }
}

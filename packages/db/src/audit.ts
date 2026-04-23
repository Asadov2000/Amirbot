import type { AuditAction, AuditActorType, JsonValue } from "@amir/shared";

import type { DbClient } from "./client.js";
import { toPrismaJsonValue } from "./utils.js";

export interface AuditLogInput {
  familyId?: string | null;
  childId?: string | null;
  actorUserId?: string | null;
  actorType?: AuditActorType;
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes?: Record<string, JsonValue> | null;
  metadata?: Record<string, JsonValue> | null;
  createdAt?: Date;
}

export async function writeAuditLog(client: DbClient, input: AuditLogInput) {
  return client.auditLog.create({
    data: {
      familyId: input.familyId ?? null,
      childId: input.childId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType ?? "USER",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      changes: toPrismaJsonValue(input.changes),
      metadata: toPrismaJsonValue(input.metadata),
      createdAt: input.createdAt ?? new Date()
    }
  });
}

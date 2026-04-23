import type { BotUserContext, TodayDigest } from "../domain/types.js";

export interface BotInteractionAuditEntry {
  telegramUserId: string;
  command: "start" | "today" | "whoami" | "internal-reminder";
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}

export interface TodayDigestQuery {
  telegramUserId: string;
  timezone: string;
  now: Date;
}

export interface FamilyCareReadModelPort {
  resolveTelegramUser(telegramUserId: string): Promise<BotUserContext | null>;
  getTodayDigest(query: TodayDigestQuery): Promise<TodayDigest | null>;
  recordBotInteraction(entry: BotInteractionAuditEntry): Promise<void>;
}

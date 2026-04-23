import type {
  BotInteractionAuditEntry,
  FamilyCareReadModelPort,
  TodayDigestQuery
} from "../ports/family-care-read-model.port.js";
import type { BotUserContext, TodayDigest } from "../domain/types.js";
import type { Logger } from "../lib/logger.js";

export class NullFamilyCareReadModel implements FamilyCareReadModelPort {
  public constructor(
    private readonly logger: Logger,
    private readonly defaultChildName?: string
  ) {}

  public async resolveTelegramUser(telegramUserId: string): Promise<BotUserContext | null> {
    this.logger.debug("Using fallback user context", { telegramUserId });

    return {
      userId: "pending-db-user",
      familyId: "pending-db-family",
      telegramUserId,
      displayName: undefined,
      timezone: "Europe/Moscow"
    };
  }

  public async getTodayDigest(_: TodayDigestQuery): Promise<TodayDigest | null> {
    return {
      childName: this.defaultChildName,
      ageLabel: undefined,
      feedingsToday: 0,
      sleepTodayMinutes: 0,
      averageFeedingIntervalMinutes: undefined,
      diapersToday: {
        wet: 0,
        dirty: 0,
        mixed: 0
      },
      lastFeedingAt: undefined,
      currentSleepStartedAt: undefined,
      lastDiaperAt: undefined,
      lastTemperature: undefined,
      lastMedication: undefined
    };
  }

  public async recordBotInteraction(entry: BotInteractionAuditEntry): Promise<void> {
    this.logger.debug("Dropping bot audit entry because db adapter is not connected", {
      command: entry.command,
      telegramUserId: entry.telegramUserId
    });
  }
}

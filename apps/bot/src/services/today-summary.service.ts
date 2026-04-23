import type { FormattedMessage } from "../domain/types.js";
import type { Logger } from "../lib/logger.js";
import type { FamilyCareReadModelPort } from "../ports/family-care-read-model.port.js";
import { MessageFormatterService } from "./message-formatter.service.js";

export class TodaySummaryService {
  public constructor(
    private readonly readModel: FamilyCareReadModelPort,
    private readonly formatter: MessageFormatterService,
    private readonly logger: Logger
  ) {}

  public async getSummaryMessage(telegramUserId: string): Promise<FormattedMessage> {
    try {
      const userContext = await this.readModel.resolveTelegramUser(telegramUserId);
      const summary = await this.readModel.getTodayDigest({
        telegramUserId,
        timezone: userContext?.timezone ?? "Europe/Moscow",
        now: new Date()
      });

      return this.formatter.formatTodayMessage(summary);
    } catch (error) {
      this.logger.error("Failed to load today summary", {
        telegramUserId,
        error: getErrorMessage(error)
      });

      return this.formatter.formatTodayMessage(null);
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

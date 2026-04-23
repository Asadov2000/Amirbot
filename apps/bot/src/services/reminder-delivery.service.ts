import type { Bot, Context } from "grammy";

import type { ReminderDispatchRequest } from "../domain/types.js";
import type { Logger } from "../lib/logger.js";
import type { FamilyCareReadModelPort } from "../ports/family-care-read-model.port.js";
import { MessageFormatterService } from "./message-formatter.service.js";

export class ReminderDeliveryService {
  public constructor(
    private readonly bot: Bot<Context>,
    private readonly formatter: MessageFormatterService,
    private readonly readModel: FamilyCareReadModelPort,
    private readonly logger: Logger
  ) {}

  public async send(request: ReminderDispatchRequest): Promise<void> {
    const formatted = this.formatter.formatReminderMessage(request);

    await this.bot.api.sendMessage(request.chatId, formatted.text, {
      parse_mode: "HTML",
      reply_markup: formatted.replyMarkup,
      link_preview_options: {
        is_disabled: true
      }
    });

    await this.readModel.recordBotInteraction({
      telegramUserId: String(request.chatId),
      command: "internal-reminder",
      occurredAt: new Date(),
      metadata: {
        reminderId: request.reminderId,
        familyId: request.familyId
      }
    });

    this.logger.info("Reminder sent to Telegram user", {
      reminderId: request.reminderId,
      familyId: request.familyId,
      chatId: request.chatId
    });
  }
}

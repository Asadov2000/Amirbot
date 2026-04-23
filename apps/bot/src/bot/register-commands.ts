import type { Bot, Context } from "grammy";

import type { Logger } from "../lib/logger.js";
import type { FamilyCareReadModelPort } from "../ports/family-care-read-model.port.js";
import { MessageFormatterService } from "../services/message-formatter.service.js";
import { TodaySummaryService } from "../services/today-summary.service.js";

export interface RegisterCommandsDependencies {
  readModel: FamilyCareReadModelPort;
  formatter: MessageFormatterService;
  todaySummaryService: TodaySummaryService;
  defaultChildName?: string;
  logger: Logger;
}

export function registerCommands(
  bot: Bot<Context>,
  dependencies: RegisterCommandsDependencies
): void {
  bot.command("start", async (ctx) => {
    const telegramUserId = String(ctx.from?.id ?? "");
    const startParam = ctx.match?.trim() || undefined;

    await dependencies.readModel.recordBotInteraction({
      telegramUserId,
      command: "start",
      occurredAt: new Date(),
      metadata: startParam ? { startParam } : undefined
    });

    const message = dependencies.formatter.formatStartMessage({
      firstName: ctx.from?.first_name,
      childName: dependencies.defaultChildName,
      startParam
    });

    await ctx.reply(message.text, {
      parse_mode: "HTML",
      reply_markup: message.replyMarkup,
      link_preview_options: {
        is_disabled: true
      }
    });

    dependencies.logger.info("Handled /start command", {
      telegramUserId,
      startParam
    });
  });

  bot.command("today", async (ctx) => {
    const telegramUserId = String(ctx.from?.id ?? "");

    await dependencies.readModel.recordBotInteraction({
      telegramUserId,
      command: "today",
      occurredAt: new Date()
    });

    const message = await dependencies.todaySummaryService.getSummaryMessage(telegramUserId);

    await ctx.reply(message.text, {
      parse_mode: "HTML",
      reply_markup: message.replyMarkup,
      link_preview_options: {
        is_disabled: true
      }
    });

    dependencies.logger.info("Handled /today command", { telegramUserId });
  });

  bot.command("whoami", async (ctx) => {
    const telegramUserId = String(ctx.from?.id ?? "");
    const username = ctx.from?.username ? `@${ctx.from.username}` : "не задан";

    await dependencies.readModel.recordBotInteraction({
      telegramUserId,
      command: "whoami",
      occurredAt: new Date()
    });

    await ctx.reply(
      [
        "<b>Ваш Telegram профиль</b>",
        `ID: <code>${telegramUserId}</code>`,
        `Username: <code>${username}</code>`
      ].join("\n"),
      {
        parse_mode: "HTML",
        link_preview_options: {
          is_disabled: true
        }
      }
    );

    dependencies.logger.info("Handled /whoami command", { telegramUserId });
  });
}

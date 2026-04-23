import { Bot, type Context } from "grammy";
import { createHash } from "node:crypto";

import { registerCommands } from "./bot/register-commands.js";
import { loadBotConfig, resolveTransport, type BotConfig } from "./config.js";
import { NullFamilyCareReadModel } from "./adapters/null-family-care-read-model.js";
import { BotHttpServer } from "./http/server.js";
import { Logger } from "./lib/logger.js";
import { DeepLinkService } from "./services/deep-link.service.js";
import { MessageFormatterService } from "./services/message-formatter.service.js";
import { ReminderDeliveryService } from "./services/reminder-delivery.service.js";
import { TodaySummaryService } from "./services/today-summary.service.js";

export interface StartedBotApplication {
  stop(): Promise<void>;
}

export async function startBotApplication(
  env: NodeJS.ProcessEnv = process.env
): Promise<StartedBotApplication> {
  const config = loadBotConfig(env);
  const logger = new Logger({ app: "@amir/bot" });
  const readModel = new NullFamilyCareReadModel(logger, config.defaultChildName);
  const deepLinkService = new DeepLinkService(config);
  const formatter = new MessageFormatterService(config, deepLinkService);
  const todaySummaryService = new TodaySummaryService(readModel, formatter, logger);
  const bot = new Bot<Context>(config.botToken);
  const reminderDeliveryService = new ReminderDeliveryService(bot, formatter, readModel, logger);
  const server = new BotHttpServer({
    bot,
    config,
    reminderDeliveryService,
    logger
  });

  registerCommands(bot, {
    readModel,
    formatter,
    todaySummaryService,
    defaultChildName: config.defaultChildName,
    logger
  });

  await bot.api.setMyCommands([
    {
      command: "start",
      description: "Открыть Mini App"
    },
    {
      command: "today",
      description: "Показать сводку за сегодня"
    },
    {
      command: "whoami",
      description: "Показать мой Telegram ID"
    }
  ]);

  await server.start();

  const transport = resolveTransport(config);

  if (transport === "webhook") {
    await configureWebhook(bot, config, logger);
  } else {
    await configurePolling(bot, logger);
  }

  logger.info("Bot application started", {
    transport,
    httpPort: config.httpPort
  });

  return {
    stop: async () => {
      await Promise.allSettled([stopTransport(bot, transport), server.stop()]);
      logger.info("Bot application stopped");
    }
  };
}

async function configureWebhook(bot: Bot<Context>, config: BotConfig, logger: Logger): Promise<void> {
  const webhookUrl = `${config.publicBaseUrl}${config.webhookPath}`;
  const webhookSecret = normalizeWebhookSecret(config.webhookSecret);

  await bot.api.setWebhook(webhookUrl, {
    secret_token: webhookSecret,
    allowed_updates: ["message", "callback_query"]
  });

  logger.info("Webhook configured", {
    webhookUrl
  });
}

function normalizeWebhookSecret(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  if (/^[A-Za-z0-9_-]{1,256}$/.test(value)) {
    return value;
  }

  return createHash("sha256").update(value).digest("hex");
}

async function configurePolling(bot: Bot<Context>, logger: Logger): Promise<void> {
  await bot.api.deleteWebhook({
    drop_pending_updates: false
  });

  void bot
    .start({
      allowed_updates: ["message", "callback_query"],
      onStart: ({ username }) => {
        logger.info("Polling started", { username });
      }
    })
    .catch((error) => {
      logger.error("Polling crashed", {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exitCode = 1;
    });
}

async function stopTransport(
  bot: Bot<Context>,
  transport: ReturnType<typeof resolveTransport>
): Promise<void> {
  if (transport === "polling") {
    bot.stop();
    return;
  }

  await bot.api.deleteWebhook({
    drop_pending_updates: false
  });
}

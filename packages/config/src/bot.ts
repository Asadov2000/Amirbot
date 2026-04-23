import { z } from "zod";

import {
  baseServerEnvSchema,
  envIntegerSchema,
  nonEmptyStringSchema,
  parseEnv,
  postgresUrlSchema,
  redisUrlSchema,
  urlSchema
} from "./common.js";

export const botEnvSchema = baseServerEnvSchema.extend({
  DATABASE_URL: postgresUrlSchema,
  REDIS_URL: redisUrlSchema,
  TELEGRAM_BOT_TOKEN: nonEmptyStringSchema.min(20),
  TELEGRAM_BOT_USERNAME: nonEmptyStringSchema.max(64),
  TELEGRAM_WEBHOOK_SECRET: nonEmptyStringSchema.min(12),
  TELEGRAM_WEBHOOK_URL: urlSchema.optional(),
  MINI_APP_URL: urlSchema,
  REMINDER_BATCH_SIZE: envIntegerSchema.min(1).max(500).default(50)
});

export type BotEnv = z.output<typeof botEnvSchema>;

export function parseBotEnv(rawEnv: NodeJS.ProcessEnv = process.env): BotEnv {
  return parseEnv(botEnvSchema, rawEnv);
}

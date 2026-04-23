import { z } from "zod";

import {
  appEnvSchema,
  envBooleanSchema,
  nodeEnvSchema,
  nonEmptyStringSchema,
  parseEnv,
  timeZoneSchema,
  urlSchema
} from "./common.js";

export const webEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  APP_ENV: appEnvSchema,
  NEXT_PUBLIC_APP_NAME: nonEmptyStringSchema.max(80).default("Amir Family Care"),
  NEXT_PUBLIC_APP_URL: urlSchema,
  NEXT_PUBLIC_API_BASE_URL: urlSchema.optional(),
  NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: nonEmptyStringSchema.max(64),
  NEXT_PUBLIC_ENABLE_MOCK_TELEGRAM: envBooleanSchema.default(false),
  NEXT_PUBLIC_DEFAULT_LOCALE: nonEmptyStringSchema.max(16).default("ru-RU"),
  NEXT_PUBLIC_DEFAULT_TIMEZONE: timeZoneSchema.default("Europe/Moscow")
});

export type WebEnv = z.output<typeof webEnvSchema>;

export function parseWebEnv(rawEnv: NodeJS.ProcessEnv = process.env): WebEnv {
  return parseEnv(webEnvSchema, rawEnv);
}

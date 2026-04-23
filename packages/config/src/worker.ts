import { z } from "zod";

import {
  baseServerEnvSchema,
  envIntegerSchema,
  parseEnv,
  postgresUrlSchema,
  redisUrlSchema,
  timeZoneSchema,
  urlSchema
} from "./common.js";

export const workerEnvSchema = baseServerEnvSchema.extend({
  DATABASE_URL: postgresUrlSchema,
  REDIS_URL: redisUrlSchema,
  WORKER_CONCURRENCY: envIntegerSchema.min(1).max(64).default(4),
  REMINDER_POLL_INTERVAL_MS: envIntegerSchema.min(1000).max(300000).default(15000),
  EXPORT_TTL_SECONDS: envIntegerSchema.min(60).max(1209600).default(86400),
  DAILY_SUMMARY_TIMEZONE: timeZoneSchema.default("Europe/Moscow"),
  EXPORTS_BASE_URL: urlSchema.optional()
});

export type WorkerEnv = z.output<typeof workerEnvSchema>;

export function parseWorkerEnv(rawEnv: NodeJS.ProcessEnv = process.env): WorkerEnv {
  return parseEnv(workerEnvSchema, rawEnv);
}

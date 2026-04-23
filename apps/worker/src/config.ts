import { getOptionalNumber, getOptionalString, getRequiredString } from "./lib/env.js";

export interface WorkerConfig {
  redisUrl: string;
  botInternalBaseUrl: string;
  botInternalApiToken: string;
  timezone: string;
  exportOutputDirectory: string;
  healthPort: number;
  reminderConcurrency: number;
  exportConcurrency: number;
  dailySummaryConcurrency: number;
  dailySummaryHour: number;
  dailySummaryMinute: number;
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  return {
    redisUrl: getRequiredString(env, "REDIS_URL"),
    botInternalBaseUrl: trimTrailingSlash(getRequiredString(env, "BOT_INTERNAL_BASE_URL")),
    botInternalApiToken: getRequiredString(env, "BOT_INTERNAL_API_TOKEN"),
    timezone: getOptionalString(env, "WORKER_TIMEZONE") ?? "Europe/Moscow",
    exportOutputDirectory: getOptionalString(env, "WORKER_EXPORT_OUTPUT_DIR") ?? "./var/exports",
    healthPort: getOptionalNumber(env, "WORKER_HEALTH_PORT") ?? 3030,
    reminderConcurrency: getOptionalNumber(env, "WORKER_REMINDER_CONCURRENCY") ?? 8,
    exportConcurrency: getOptionalNumber(env, "WORKER_EXPORT_CONCURRENCY") ?? 2,
    dailySummaryConcurrency: getOptionalNumber(env, "WORKER_DAILY_SUMMARY_CONCURRENCY") ?? 2,
    dailySummaryHour: getOptionalNumber(env, "WORKER_DAILY_SUMMARY_HOUR") ?? 0,
    dailySummaryMinute: getOptionalNumber(env, "WORKER_DAILY_SUMMARY_MINUTE") ?? 5
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

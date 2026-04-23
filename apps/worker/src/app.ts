import { createQueue } from "./queues/create-queue.js";
import { createWorkers, type WorkerSet } from "./workers/create-workers.js";
import { loadWorkerConfig } from "./config.js";
import { NullCareBackend } from "./adapters/null-care-backend.js";
import { BotInternalClient } from "./clients/bot-internal.client.js";
import { HealthServer } from "./http/health-server.js";
import { Logger } from "./lib/logger.js";
import { closeRedisConnection, createRedisConnection } from "./queues/redis.js";
import { QUEUE_NAMES } from "./queues/names.js";
import { DailySummaryScheduler } from "./scheduler/daily-summary.scheduler.js";
import { DailySummaryService } from "./services/daily-summary.service.js";
import { ExportGeneratorService } from "./services/export-generator.service.js";
import { ReminderProcessorService } from "./services/reminder-processor.service.js";
import type { DailySummaryJobPayload, ExportJobPayload, ReminderJobPayload } from "./domain/jobs.js";

export interface StartedWorkerApplication {
  stop(): Promise<void>;
}

export async function startWorkerApplication(
  env: NodeJS.ProcessEnv = process.env
): Promise<StartedWorkerApplication> {
  const config = loadWorkerConfig(env);
  const logger = new Logger({ app: "@amir/worker" });
  const backend = new NullCareBackend(logger);
  const botClient = new BotInternalClient(config, logger);
  const reminderProcessor = new ReminderProcessorService(backend, botClient, logger);
  const exportGenerator = new ExportGeneratorService(config, backend, logger);
  const dailySummaryService = new DailySummaryService(backend, logger);
  const healthServer = new HealthServer(config.healthPort, logger);

  const queueConnection = createRedisConnection(config.redisUrl, "worker-queue");
  const reminderWorkerConnection = createRedisConnection(config.redisUrl, "worker-reminder");
  const exportWorkerConnection = createRedisConnection(config.redisUrl, "worker-export");
  const dailySummaryWorkerConnection = createRedisConnection(config.redisUrl, "worker-daily-summary");

  const reminderQueue = createQueue<ReminderJobPayload>(QUEUE_NAMES.reminders, queueConnection);
  const exportQueue = createQueue<ExportJobPayload>(QUEUE_NAMES.exports, queueConnection);
  const dailySummaryQueue = createQueue<DailySummaryJobPayload>(
    QUEUE_NAMES.dailySummaries,
    queueConnection
  );

  const workers = createWorkers({
    config,
    reminderConnection: reminderWorkerConnection,
    exportConnection: exportWorkerConnection,
    dailySummaryConnection: dailySummaryWorkerConnection,
    reminderProcessor,
    exportGenerator,
    dailySummaryService,
    logger
  });

  const scheduler = new DailySummaryScheduler(dailySummaryQueue, config, logger);

  await Promise.all([healthServer.start(), scheduler.start()]);

  logger.info("Worker application started", {
    reminderQueue: QUEUE_NAMES.reminders,
    exportQueue: QUEUE_NAMES.exports,
    dailySummaryQueue: QUEUE_NAMES.dailySummaries,
    timezone: config.timezone
  });

  return {
    stop: async () => {
      await Promise.allSettled([
        scheduler.stop(),
        healthServer.stop(),
        closeWorkers(workers),
        reminderQueue.close(),
        exportQueue.close(),
        dailySummaryQueue.close()
      ]);

      await Promise.allSettled([
        closeRedisConnection(queueConnection),
        closeRedisConnection(reminderWorkerConnection),
        closeRedisConnection(exportWorkerConnection),
        closeRedisConnection(dailySummaryWorkerConnection)
      ]);

      logger.info("Worker application stopped");
    }
  };
}

async function closeWorkers(workers: WorkerSet): Promise<void> {
  await Promise.all([
    workers.reminderWorker.close(),
    workers.exportWorker.close(),
    workers.dailySummaryWorker.close()
  ]);
}

import { Worker, type Job } from "bullmq";

import type { WorkerConfig } from "../config.js";
import type {
  DailySummaryJobPayload,
  ExportJobPayload,
  ReminderJobPayload
} from "../domain/jobs.js";
import type { Logger } from "../lib/logger.js";
import { QUEUE_NAMES } from "../queues/names.js";
import type { RedisConnection } from "../queues/redis.js";
import { DailySummaryService } from "../services/daily-summary.service.js";
import { ExportGeneratorService } from "../services/export-generator.service.js";
import { ReminderProcessorService } from "../services/reminder-processor.service.js";

export interface WorkerSet {
  reminderWorker: Worker<ReminderJobPayload>;
  exportWorker: Worker<ExportJobPayload>;
  dailySummaryWorker: Worker<DailySummaryJobPayload>;
}

export interface CreateWorkersDependencies {
  config: Pick<
    WorkerConfig,
    "reminderConcurrency" | "exportConcurrency" | "dailySummaryConcurrency"
  >;
  reminderConnection: RedisConnection;
  exportConnection: RedisConnection;
  dailySummaryConnection: RedisConnection;
  reminderProcessor: ReminderProcessorService;
  exportGenerator: ExportGeneratorService;
  dailySummaryService: DailySummaryService;
  logger: Logger;
}

export function createWorkers(dependencies: CreateWorkersDependencies): WorkerSet {
  const reminderWorker = new Worker<ReminderJobPayload>(
    QUEUE_NAMES.reminders,
    async (job) => dependencies.reminderProcessor.process(job),
    {
      connection: dependencies.reminderConnection,
      concurrency: dependencies.config.reminderConcurrency
    }
  );

  const exportWorker = new Worker<ExportJobPayload>(
    QUEUE_NAMES.exports,
    async (job) => dependencies.exportGenerator.process(job),
    {
      connection: dependencies.exportConnection,
      concurrency: dependencies.config.exportConcurrency
    }
  );

  const dailySummaryWorker = new Worker<DailySummaryJobPayload>(
    QUEUE_NAMES.dailySummaries,
    async (job) => dependencies.dailySummaryService.process(job),
    {
      connection: dependencies.dailySummaryConnection,
      concurrency: dependencies.config.dailySummaryConcurrency
    }
  );

  attachWorkerLogging(reminderWorker, dependencies.logger.child({ queue: QUEUE_NAMES.reminders }));
  attachWorkerLogging(exportWorker, dependencies.logger.child({ queue: QUEUE_NAMES.exports }));
  attachWorkerLogging(
    dailySummaryWorker,
    dependencies.logger.child({ queue: QUEUE_NAMES.dailySummaries })
  );

  return {
    reminderWorker,
    exportWorker,
    dailySummaryWorker
  };
}

function attachWorkerLogging<DataType>(worker: Worker<DataType>, logger: Logger): void {
  worker.on("completed", (job) => {
    logger.info("Job completed", {
      jobId: job?.id,
      name: job?.name
    });
  });

  worker.on("failed", (job: Job<DataType> | undefined, error) => {
    logger.error("Job failed", {
      jobId: job?.id,
      name: job?.name,
      error: error.message
    });
  });

  worker.on("error", (error) => {
    logger.error("Worker emitted error", {
      error: error.message
    });
  });
}

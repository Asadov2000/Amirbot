import type { Queue } from "bullmq";

import type { WorkerConfig } from "../config.js";
import type { DailySummaryJobPayload } from "../domain/jobs.js";
import type { Logger } from "../lib/logger.js";

const POLL_INTERVAL_MS = 15 * 60 * 1000;

export class DailySummaryScheduler {
  private intervalHandle?: NodeJS.Timeout;

  public constructor(
    private readonly queue: Queue<DailySummaryJobPayload>,
    private readonly config: Pick<
      WorkerConfig,
      "dailySummaryHour" | "dailySummaryMinute" | "timezone"
    >,
    private readonly logger: Logger
  ) {}

  public async start(): Promise<void> {
    await this.ensureNextJob();

    this.intervalHandle = setInterval(() => {
      void this.ensureNextJob();
    }, POLL_INTERVAL_MS);

    this.intervalHandle.unref();
  }

  public async stop(): Promise<void> {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
  }

  public async ensureNextJob(now = new Date()): Promise<void> {
    const scheduledRunToday = getScheduledRunForDay(
      now,
      this.config.dailySummaryHour,
      this.config.dailySummaryMinute
    );

    if (scheduledRunToday.getTime() <= now.getTime()) {
      await this.scheduleIfMissing(scheduledRunToday, now, 0);
      await this.scheduleIfMissing(addDays(scheduledRunToday, 1), now);
      return;
    }

    await this.scheduleIfMissing(scheduledRunToday, now);
  }

  private async scheduleIfMissing(
    runAt: Date,
    now: Date,
    forcedDelayMs?: number
  ): Promise<void> {
    const summaryDate = formatDateForSummary(runAt);
    const jobId = `daily-summary:${summaryDate}`;
    const existingJob = await this.queue.getJob(jobId);

    if (existingJob) {
      return;
    }

    const delay = forcedDelayMs ?? Math.max(runAt.getTime() - now.getTime(), 0);

    await this.queue.add(
      "daily-summary.generate",
      {
        date: summaryDate,
        timezone: this.config.timezone,
        trigger: "scheduled"
      },
      {
        jobId,
        delay
      }
    );

    this.logger.info("Scheduled daily summary job", {
      jobId,
      runAt: runAt.toISOString(),
      summaryDate,
      delay
    });
  }
}

function getScheduledRunForDay(now: Date, hour: number, minute: number): Date {
  const nextRun = new Date(now);
  nextRun.setHours(hour, minute, 0, 0);
  return nextRun;
}

function addDays(input: Date, days: number): Date {
  const next = new Date(input);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateForSummary(runAt: Date): string {
  const summaryDate = new Date(runAt);
  summaryDate.setDate(summaryDate.getDate() - 1);
  return summaryDate.toISOString().slice(0, 10);
}

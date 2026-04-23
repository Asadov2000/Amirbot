import type { Job } from "bullmq";

import type { ReminderJobPayload } from "../domain/jobs.js";
import type { Logger } from "../lib/logger.js";
import type { CareBackendPort } from "../ports/care-backend.port.js";
import { BotInternalClient } from "../clients/bot-internal.client.js";

export class ReminderProcessorService {
  public constructor(
    private readonly backend: CareBackendPort,
    private readonly botInternalClient: BotInternalClient,
    private readonly logger: Logger
  ) {}

  public async process(job: Job<ReminderJobPayload>): Promise<void> {
    const processingGate = await this.backend.beginReminderDelivery(
      job.data.reminderId,
      String(job.id ?? job.name)
    );

    if (!processingGate.shouldProcess) {
      this.logger.info("Skipping duplicate reminder delivery", {
        reminderId: job.data.reminderId,
        reason: processingGate.reason
      });
      return;
    }

    try {
      await this.botInternalClient.sendReminder(job.data);
      await this.backend.completeReminderDelivery(job.data.reminderId, new Date());
      this.logger.info("Reminder job processed", {
        reminderId: job.data.reminderId,
        queueJobId: job.id
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.backend.failReminderDelivery(job.data.reminderId, errorMessage);
      throw error;
    }
  }
}

import type { Job } from "bullmq";

import type { DailySummaryJobPayload } from "../domain/jobs.js";
import type { Logger } from "../lib/logger.js";
import type { CareBackendPort } from "../ports/care-backend.port.js";

export class DailySummaryService {
  public constructor(
    private readonly backend: CareBackendPort,
    private readonly logger: Logger
  ) {}

  public async process(job: Job<DailySummaryJobPayload>): Promise<number> {
    const summaries = await this.backend.loadDailySummaryInputs(job.data);

    if (!summaries.length) {
      this.logger.info("No daily summary inputs for job", {
        date: job.data.date,
        trigger: job.data.trigger,
        familyId: job.data.familyId
      });
      return 0;
    }

    for (const summary of summaries) {
      await this.backend.saveDailySummary(summary);
    }

    this.logger.info("Daily summaries persisted", {
      date: job.data.date,
      count: summaries.length,
      trigger: job.data.trigger
    });

    return summaries.length;
  }
}

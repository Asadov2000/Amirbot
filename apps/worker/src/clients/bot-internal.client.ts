import type { WorkerConfig } from "../config.js";
import type { ReminderJobPayload } from "../domain/jobs.js";
import type { Logger } from "../lib/logger.js";

export class BotInternalClient {
  public constructor(
    private readonly config: Pick<WorkerConfig, "botInternalBaseUrl" | "botInternalApiToken">,
    private readonly logger: Logger
  ) {}

  public async sendReminder(payload: ReminderJobPayload): Promise<void> {
    const response = await fetch(`${this.config.botInternalBaseUrl}/internal/reminders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.botInternalApiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.text();

      this.logger.error("Bot internal API rejected reminder", {
        reminderId: payload.reminderId,
        status: response.status,
        body
      });

      throw new Error(`Bot internal API rejected reminder delivery with status ${response.status}`);
    }
  }
}

import type { Logger } from "../lib/logger.js";
import type {
  DailySummaryInput,
  DailySummaryJobPayload,
  ExportBundle,
  ExportJobPayload
} from "../domain/jobs.js";
import type {
  CareBackendPort,
  ExportCompletionInput,
  ReminderLockResult
} from "../ports/care-backend.port.js";

export class NullCareBackend implements CareBackendPort {
  public constructor(private readonly logger: Logger) {}

  public async beginReminderDelivery(reminderId: string, jobId: string): Promise<ReminderLockResult> {
    this.logger.debug("Using fallback reminder lock because packages/db is not connected", {
      reminderId,
      jobId
    });

    return {
      shouldProcess: true
    };
  }

  public async completeReminderDelivery(reminderId: string, deliveredAt: Date): Promise<void> {
    this.logger.debug("Reminder delivery completion dropped by fallback backend", {
      reminderId,
      deliveredAt: deliveredAt.toISOString()
    });
  }

  public async failReminderDelivery(reminderId: string, errorMessage: string): Promise<void> {
    this.logger.warn("Reminder delivery failure stored only in worker logs", {
      reminderId,
      errorMessage
    });
  }

  public async loadExportBundle(payload: ExportJobPayload): Promise<ExportBundle | null> {
    return {
      exportJobId: payload.exportJobId,
      title: "Экспорт дневника ребёнка",
      periodLabel: `${payload.fromDate} — ${payload.toDate}`,
      generatedAt: new Date().toISOString(),
      childName: "Ребёнок",
      familyName: "Семья",
      overview: [
        {
          label: "Формат",
          value: payload.format.toUpperCase()
        },
        {
          label: "Период",
          value: `${payload.fromDate} — ${payload.toDate}`
        },
        {
          label: "Статус",
          value: "Требуется подключение packages/db для реальных данных"
        }
      ],
      sections: [
        {
          title: "Интеграционный статус",
          rows: [
            {
              note: "Подключите ExportJob/DailySummary/CareEvent read model из packages/db.",
              familyId: payload.familyId,
              childId: payload.childId
            }
          ]
        }
      ]
    };
  }

  public async completeExportJob(input: ExportCompletionInput): Promise<void> {
    this.logger.info("Export completion was handled by fallback backend", {
      exportJobId: input.exportJobId,
      status: input.status,
      filePath: input.filePath
    });
  }

  public async loadDailySummaryInputs(
    payload: DailySummaryJobPayload
  ): Promise<DailySummaryInput[]> {
    if (!payload.familyId || !payload.childId) {
      this.logger.info("No fallback daily summary targets for scheduled job", {
        date: payload.date,
        trigger: payload.trigger
      });
      return [];
    }

    return [
      {
        familyId: payload.familyId,
        childId: payload.childId,
        date: payload.date,
        timezone: payload.timezone,
        metrics: {
          feedings: 0,
          sleepMinutes: 0,
          averageFeedingIntervalMinutes: undefined,
          wetDiapers: 0,
          dirtyDiapers: 0,
          mixedDiapers: 0,
          medications: 0,
          temperatures: 0,
          notes: 0
        }
      }
    ];
  }

  public async saveDailySummary(input: DailySummaryInput): Promise<void> {
    this.logger.info("Daily summary calculated in fallback backend", {
      familyId: input.familyId,
      childId: input.childId,
      date: input.date
    });
  }
}

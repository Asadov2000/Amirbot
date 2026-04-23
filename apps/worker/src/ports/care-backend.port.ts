import type {
  DailySummaryInput,
  DailySummaryJobPayload,
  ExportBundle,
  ExportJobFormat,
  ExportJobPayload
} from "../domain/jobs.js";

export interface ReminderLockResult {
  shouldProcess: boolean;
  reason?: string;
}

export interface ExportCompletionInput {
  exportJobId: string;
  status: "completed" | "failed";
  format: ExportJobFormat;
  filePath?: string;
  completedAt: Date;
  errorMessage?: string;
}

export interface CareBackendPort {
  beginReminderDelivery(reminderId: string, jobId: string): Promise<ReminderLockResult>;
  completeReminderDelivery(reminderId: string, deliveredAt: Date): Promise<void>;
  failReminderDelivery(reminderId: string, errorMessage: string): Promise<void>;
  loadExportBundle(payload: ExportJobPayload): Promise<ExportBundle | null>;
  completeExportJob(input: ExportCompletionInput): Promise<void>;
  loadDailySummaryInputs(payload: DailySummaryJobPayload): Promise<DailySummaryInput[]>;
  saveDailySummary(input: DailySummaryInput): Promise<void>;
}

export type ReminderKind = "feeding" | "sleep" | "diaper" | "medication" | "custom";
export type ExportJobFormat = "pdf" | "csv";

export interface ReminderJobPayload {
  reminderId: string;
  familyId: string;
  chatId: number | string;
  title: string;
  body: string;
  dueAt: string;
  kind: ReminderKind;
  startParam?: string;
  metadata?: Record<string, unknown>;
}

export interface ExportJobPayload {
  exportJobId: string;
  familyId: string;
  childId: string;
  requestedByUserId: string;
  format: ExportJobFormat;
  fromDate: string;
  toDate: string;
  locale?: string;
}

export interface DailySummaryJobPayload {
  familyId?: string;
  childId?: string;
  date: string;
  timezone: string;
  trigger: "scheduled" | "manual";
}

export interface DailySummaryInput {
  familyId: string;
  childId: string;
  date: string;
  timezone: string;
  metrics: {
    feedings: number;
    sleepMinutes: number;
    averageFeedingIntervalMinutes?: number;
    wetDiapers: number;
    dirtyDiapers: number;
    mixedDiapers: number;
    medications: number;
    temperatures: number;
    notes: number;
  };
}

export interface ExportBundle {
  exportJobId: string;
  title: string;
  periodLabel: string;
  generatedAt: string;
  childName?: string;
  familyName?: string;
  overview: Array<{
    label: string;
    value: string;
  }>;
  sections: Array<{
    title: string;
    rows: Array<Record<string, string | number | boolean | null>>;
  }>;
}

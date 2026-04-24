export type ActorId = "mom" | "dad";

export const actorLabels: Record<ActorId, string> = {
  mom: "Мама",
  dad: "Папа",
};

export type CareEventKind =
  | "FEEDING"
  | "SOLID_FOOD"
  | "SLEEP"
  | "DIAPER"
  | "TEMPERATURE"
  | "MEDICATION"
  | "GROWTH"
  | "NOTE";

export type QuickItemKind = Extract<CareEventKind, "SOLID_FOOD" | "MEDICATION">;

export type EventStatus = "LOGGED" | "STARTED" | "COMPLETED";

export interface ChildProfile {
  id: string;
  name: string;
  birthDate: string;
  ageLabel: string;
}

export interface CareEventRecord {
  id: string;
  idempotencyKey: string;
  kind: CareEventKind;
  actor: ActorId;
  occurredAt: string;
  summary: string;
  payload: Record<string, string | number | boolean | null>;
  status: EventStatus;
  editedAt?: string;
  source: "server" | "local";
}

export interface OverviewCard {
  age: string;
  lastFeeding: string;
  sleepStatus: string;
  diaperGap: string;
  temperature: string;
  medication: string;
}

export interface ReminderCard {
  id: string;
  title: string;
  dueLabel: string;
  tone: "default" | "warn" | "danger";
  channel: "bot" | "mini-app";
}

export interface DailySummary {
  dateLabel: string;
  feedingsCount: number;
  solidFoodsCount?: number;
  totalSleepMinutes: number;
  averageFeedingIntervalMinutes: number;
  diaperWetCount: number;
  diaperDirtyCount: number;
  diaperMixedCount?: number;
  temperatureReadingsCount: number;
  medicationsCount: number;
  growthReadingsCount?: number;
}

export type SummaryPeriodId = "1d" | "3d" | "7d" | "30d" | "365d" | "all";

export interface PeriodSummary extends DailySummary {
  id: SummaryPeriodId;
  title: string;
  days: number | null;
}

export interface TimerState {
  sleepStartedAt?: string;
  sleepDurationMinutes?: number;
  nextFeedingAt?: string;
  nextDiaperCheckAt?: string;
}

export interface AiInsight {
  id: string;
  title: string;
  body: string;
  tone: "default" | "warn" | "danger";
}

export interface QuickItemRecord {
  kind: QuickItemKind;
  key: string;
  label: string;
  detail?: string;
  updatedAt: string;
}

export interface DashboardSnapshot {
  generatedAt: string;
  child: ChildProfile;
  overview: OverviewCard;
  reminders: ReminderCard[];
  timers: TimerState;
  summary: DailySummary;
  periodSummaries: PeriodSummary[];
  quickItems: QuickItemRecord[];
  events: CareEventRecord[];
  insights: AiInsight[];
}

export interface EventDraft {
  kind: CareEventKind;
  actor: ActorId;
  occurredAt: string;
  summary: string;
  payload: Record<string, string | number | boolean | null>;
  status?: EventStatus;
}

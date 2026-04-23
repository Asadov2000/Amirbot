export type ActorId = "mom" | "dad";

export const actorLabels: Record<ActorId, string> = {
  mom: "Мама",
  dad: "Папа",
};

export type CareEventKind =
  | "FEEDING"
  | "SLEEP"
  | "DIAPER"
  | "TEMPERATURE"
  | "MEDICATION"
  | "NOTE";

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
  totalSleepMinutes: number;
  averageFeedingIntervalMinutes: number;
  diaperWetCount: number;
  diaperDirtyCount: number;
  temperatureReadingsCount: number;
  medicationsCount: number;
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

export interface DashboardSnapshot {
  generatedAt: string;
  child: ChildProfile;
  overview: OverviewCard;
  reminders: ReminderCard[];
  timers: TimerState;
  summary: DailySummary;
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

import type { InlineKeyboard } from "grammy";

export interface TodayDigest {
  childName?: string;
  ageLabel?: string;
  feedingsToday: number;
  sleepTodayMinutes: number;
  averageFeedingIntervalMinutes?: number;
  diapersToday: {
    wet: number;
    dirty: number;
    mixed: number;
  };
  lastFeedingAt?: string;
  currentSleepStartedAt?: string;
  lastDiaperAt?: string;
  lastTemperature?: {
    valueCelsius: number;
    measuredAt: string;
  };
  lastMedication?: {
    name: string;
    dose?: string;
    givenAt: string;
  };
}

export interface ReminderDispatchRequest {
  reminderId: string;
  familyId: string;
  chatId: number | string;
  title: string;
  body: string;
  dueAt: string;
  startParam?: string;
  metadata?: Record<string, unknown>;
}

export interface FormattedMessage {
  text: string;
  replyMarkup?: InlineKeyboard;
}

export interface BotUserContext {
  userId: string;
  familyId: string;
  telegramUserId: string;
  displayName?: string;
  timezone: string;
}

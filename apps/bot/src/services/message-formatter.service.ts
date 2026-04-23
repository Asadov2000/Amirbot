import { InlineKeyboard } from "grammy";

import type { BotConfig } from "../config.js";
import type { FormattedMessage, ReminderDispatchRequest, TodayDigest } from "../domain/types.js";
import { DeepLinkService } from "./deep-link.service.js";

export class MessageFormatterService {
  private readonly dateTimeFormatter: Intl.DateTimeFormat;
  private readonly timeFormatter: Intl.DateTimeFormat;

  public constructor(
    config: Pick<BotConfig, "timezone" | "defaultChildName">,
    private readonly deepLinkService: DeepLinkService
  ) {
    this.dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: config.timezone
    });

    this.timeFormatter = new Intl.DateTimeFormat("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: config.timezone
    });
  }

  public formatStartMessage(input: {
    firstName?: string;
    childName?: string;
    startParam?: string;
  }): FormattedMessage {
    const launchUrl = this.deepLinkService.buildMiniAppUrl(
      input.startParam ?? this.deepLinkService.buildStartParam("home")
    );
    const greeting = input.firstName ? `Привет, ${escapeHtml(input.firstName)}.` : "Привет.";
    const childName = input.childName ? `Для ребёнка: <b>${escapeHtml(input.childName)}</b>.` : "";

    return {
      text: [
        `<b>${greeting}</b>`,
        "Я отправляю напоминания и помогаю быстро открыть семейный Mini App.",
        childName,
        "Команды:",
        "/today — краткая сводка за сегодня"
      ]
        .filter(Boolean)
        .join("\n\n"),
      replyMarkup: new InlineKeyboard().url("Открыть Mini App", launchUrl)
    };
  }

  public formatTodayMessage(summary: TodayDigest | null): FormattedMessage {
    if (!summary) {
      return {
        text: [
          "<b>Сводка пока недоступна</b>",
          "Подключите read-model из packages/db, чтобы бот показывал актуальные данные семьи."
        ].join("\n\n"),
        replyMarkup: new InlineKeyboard().url(
          "Открыть Mini App",
          this.deepLinkService.buildMiniAppUrl(this.deepLinkService.buildStartParam("today"))
        )
      };
    }

    const childName = summary.childName ? `<b>${escapeHtml(summary.childName)}</b>` : "ребёнок";
    const lines = [
      `<b>Сегодня: ${childName}</b>`,
      `Кормлений: <b>${summary.feedingsToday}</b>`,
      `Сна: <b>${formatMinutes(summary.sleepTodayMinutes)}</b>`,
      `Подгузники: <b>${summary.diapersToday.wet}</b> моча, <b>${summary.diapersToday.dirty}</b> кака, <b>${summary.diapersToday.mixed}</b> смешанных`,
      `Последнее кормление: <b>${formatMaybeDate(summary.lastFeedingAt, this.dateTimeFormatter)}</b>`,
      `Сон сейчас: <b>${formatMaybeDate(summary.currentSleepStartedAt, this.timeFormatter, "не спит")}</b>`,
      `Последний подгузник: <b>${formatMaybeDate(summary.lastDiaperAt, this.dateTimeFormatter)}</b>`
    ];

    if (summary.averageFeedingIntervalMinutes) {
      lines.push(`Средний интервал между кормлениями: <b>${formatMinutes(summary.averageFeedingIntervalMinutes)}</b>`);
    }

    if (summary.lastTemperature) {
      lines.push(
        `Температура: <b>${summary.lastTemperature.valueCelsius.toFixed(1)}°C</b> в ${formatMaybeDate(summary.lastTemperature.measuredAt, this.timeFormatter)}`
      );
    }

    if (summary.lastMedication) {
      const dose = summary.lastMedication.dose ? `, ${escapeHtml(summary.lastMedication.dose)}` : "";
      lines.push(
        `Лекарство: <b>${escapeHtml(summary.lastMedication.name)}${dose}</b> в ${formatMaybeDate(summary.lastMedication.givenAt, this.timeFormatter)}`
      );
    }

    return {
      text: lines.join("\n"),
      replyMarkup: new InlineKeyboard().url(
        "Открыть дневник",
        this.deepLinkService.buildMiniAppUrl(this.deepLinkService.buildStartParam("today"))
      )
    };
  }

  public formatReminderMessage(request: ReminderDispatchRequest): FormattedMessage {
    const lines = [
      `<b>${escapeHtml(request.title)}</b>`,
      escapeHtml(request.body),
      `Запланировано: <b>${formatMaybeDate(request.dueAt, this.dateTimeFormatter)}</b>`
    ];

    return {
      text: lines.join("\n\n"),
      replyMarkup: new InlineKeyboard().url(
        "Открыть Mini App",
        this.deepLinkService.buildMiniAppUrl(
          request.startParam ?? this.deepLinkService.buildStartParam("reminder", request.reminderId)
        )
      )
    };
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMaybeDate(
  value: string | undefined,
  formatter: Intl.DateTimeFormat,
  fallback = "нет данных"
): string {
  if (!value) {
    return fallback;
  }

  return formatter.format(new Date(value));
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) {
    return `${minutes} мин`;
  }

  if (!minutes) {
    return `${hours} ч`;
  }

  return `${hours} ч ${minutes} мин`;
}

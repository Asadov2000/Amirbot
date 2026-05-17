"use client";

import { useEffect, useRef, useState } from "react";

import {
  ActionButton,
  BottomTabs,
  Card,
  EmptyState,
  GhostButton,
  InlineMetric,
  Pill,
  PrimaryButton,
  SectionTitle,
  Surface,
} from "@amir/ui";

import {
  actorLabel,
  calculateAgeBreakdown,
  formatDateTime,
  formatDuration,
  formatTime,
} from "@/lib/format";
import type {
  ActorId,
  CareEventKind,
  CareEventRecord,
  DailySummary,
  EventDraft,
  EventStatus,
  PeriodSummary,
  QuickItemKind,
  QuickItemRecord,
  SummaryPeriodId,
} from "@/lib/types";
import { useCareDashboard } from "@/hooks/use-care-dashboard";

type TabId = "home" | "log" | "feed" | "summary" | "export";
type ActionId =
  | "feeding"
  | "diaper"
  | "solid_food"
  | "sleep"
  | "medication"
  | "temperature"
  | "note"
  | "growth"
  | "walk"
  | "bath";
type FeedKindFilter = CareEventKind | "ALL";
type ActorFilter = ActorId | "ALL";

interface ActionField {
  id: string;
  label: string;
  defaultValue?: string;
  inputPlaceholder?: string;
  inputType?: "text" | "number";
}

interface ActionPreset {
  id: string;
  label: string;
  helper: string;
  defaultInput?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputType?: "text" | "number";
  fields?: ActionField[];
  hiddenForActors?: ActorId[];
  quickItem?: {
    kind: QuickItemKind;
    key: string;
    label: string;
  };
  tone?: "default" | "warn" | "danger";
  buildDraft: (context: {
    actor: ActorId;
    occurredAt: string;
    inputValue: string;
    fieldValues: Record<string, string>;
  }) => EventDraft;
}

interface ActionDefinition {
  id: ActionId;
  kind: CareEventKind;
  icon: string;
  title: string;
  subtitle: string;
  presets: ActionPreset[];
}

interface GrowthReading {
  id: string;
  label: string;
  occurredAt: string;
  weightKg: number | null;
  heightCm: number | null;
}

type GrowthMetricKey = "weightKg" | "heightCm";

const tabs = [
  { id: "home", label: "Главная", icon: "🏠" },
  { id: "log", label: "Запись", icon: "✚" },
  { id: "feed", label: "Лента", icon: "☰" },
  { id: "summary", label: "Итоги", icon: "▦" },
  { id: "export", label: "Отчёт", icon: "↓" },
] satisfies Array<{ id: TabId; label: string; icon: string }>;

const kindFilterOptions: Array<{ id: FeedKindFilter; label: string }> = [
  { id: "ALL", label: "Все" },
  { id: "FEEDING", label: "Кормление" },
  { id: "DIAPER", label: "Подгузник" },
  { id: "SOLID_FOOD", label: "Прикорм" },
  { id: "SLEEP", label: "Сон" },
  { id: "WALK", label: "Прогулка" },
  { id: "BATH", label: "Купание" },
  { id: "MEDICATION", label: "Лекарства" },
  { id: "TEMPERATURE", label: "Температура" },
  { id: "GROWTH", label: "Вес/рост" },
  { id: "NOTE", label: "Заметки" },
];

const actorFilterOptions: Array<{ id: ActorFilter; label: string }> = [
  { id: "ALL", label: "Оба" },
  { id: "mom", label: "Мама" },
  { id: "dad", label: "Папа" },
];

const actions: ActionDefinition[] = [
  {
    id: "feeding",
    kind: "FEEDING",
    icon: "🍼",
    title: "Кормление",
    subtitle: "Грудь, бутылочка или сцеженное молоко",
    presets: [
      {
        id: "breast",
        label: "Грудь",
        helper: "По умолчанию 18 минут",
        defaultInput: "18",
        inputLabel: "Минуты",
        inputType: "number",
        hiddenForActors: ["dad"],
        buildDraft: ({ actor, occurredAt, inputValue }) => {
          const durationMinutes = parseNumber(inputValue, 18);
          return {
            kind: "FEEDING",
            actor,
            occurredAt,
            summary: `Грудь — ${durationMinutes} мин`,
            payload: { mode: "BREAST", durationMinutes },
            status: "COMPLETED",
          };
        },
      },
      {
        id: "breast_bottle",
        label: "Сцеженное молоко",
        helper: "Грудное молоко в бутылочке",
        defaultInput: "100",
        inputLabel: "Миллилитры",
        inputType: "number",
        buildDraft: ({ actor, occurredAt, inputValue }) => {
          const volumeMl = parseNumber(inputValue, 100);
          return {
            kind: "FEEDING",
            actor,
            occurredAt,
            summary: `Сцеженное молоко — ${volumeMl} мл`,
            payload: { mode: "BREAST_BOTTLE", volumeMl },
            status: "COMPLETED",
          };
        },
      },
      {
        id: "bottle",
        label: "Смесь",
        helper: "По умолчанию 120 мл",
        defaultInput: "120",
        inputLabel: "Миллилитры",
        inputType: "number",
        buildDraft: ({ actor, occurredAt, inputValue }) => {
          const volumeMl = parseNumber(inputValue, 120);
          return {
            kind: "FEEDING",
            actor,
            occurredAt,
            summary: `Смесь — ${volumeMl} мл`,
            payload: { mode: "BOTTLE", volumeMl },
            status: "COMPLETED",
          };
        },
      },
    ],
  },
  {
    id: "sleep",
    kind: "SLEEP",
    icon: "🌙",
    title: "Сон",
    subtitle: "Начало или пробуждение",
    presets: [
      {
        id: "sleep_start",
        label: "Уснул",
        helper: "Старт таймера сна",
        buildDraft: ({ actor, occurredAt }) => ({
          kind: "SLEEP",
          actor,
          occurredAt,
          summary: "Сон начался",
          payload: { phase: "START" },
          status: "STARTED",
        }),
      },
      {
        id: "sleep_end",
        label: "Проснулся",
        helper: "Завершение сна",
        buildDraft: ({ actor, occurredAt }) => ({
          kind: "SLEEP",
          actor,
          occurredAt,
          summary: "Проснулся",
          payload: { phase: "END" },
          status: "COMPLETED",
        }),
      },
    ],
  },
  {
    id: "diaper",
    kind: "DIAPER",
    icon: "🧷",
    title: "Подгузник",
    subtitle: "Что было и сменили ли подгузник",
    presets: [
      {
        id: "wet",
        label: "Пописал",
        helper: "",
        buildDraft: ({ actor, occurredAt }) => ({
          kind: "DIAPER",
          actor,
          occurredAt,
          summary: "Сменили подгузник — пописал",
          payload: { type: "WET", changed: true },
          status: "LOGGED",
        }),
      },
      {
        id: "dirty",
        label: "Покакал",
        helper: "",
        buildDraft: ({ actor, occurredAt }) => ({
          kind: "DIAPER",
          actor,
          occurredAt,
          summary: "Сменили подгузник — покакал",
          payload: { type: "DIRTY", changed: true },
          status: "LOGGED",
        }),
      },
      {
        id: "mixed",
        label: "Пописал и покакал",
        helper: "",
        buildDraft: ({ actor, occurredAt }) => ({
          kind: "DIAPER",
          actor,
          occurredAt,
          summary: "Сменили подгузник — пописал и покакал",
          payload: { type: "MIXED", changed: true },
          status: "LOGGED",
        }),
      },
    ],
  },
  {
    id: "temperature",
    kind: "TEMPERATURE",
    icon: "🌡️",
    title: "Температура",
    subtitle: "Одно поле без длинной формы",
    presets: [
      {
        id: "temperature",
        label: "Замер температуры",
        helper: "Например 36.8",
        defaultInput: "36.8",
        inputLabel: "°C",
        inputType: "number",
        buildDraft: ({ actor, occurredAt, inputValue }) => {
          const temperatureC = parseNumber(inputValue, 36.8);
          return {
            kind: "TEMPERATURE",
            actor,
            occurredAt,
            summary: `Температура ${temperatureC.toFixed(1)}°C`,
            payload: { temperatureC },
            status: "LOGGED",
          };
        },
      },
    ],
  },
  {
    id: "solid_food",
    kind: "SOLID_FOOD",
    icon: "🥣",
    title: "Прикорм",
    subtitle: "Список пустой — добавляйте продукты по мере введения",
    presets: [
      {
        id: "solid_food",
        label: "Добавить прикорм",
        helper: "Например: кабачок 2 ложки, реакции нет",
        defaultInput: "",
        inputLabel: "Продукт и реакция",
        inputPlaceholder: "Кабачок, 2 ложки, без реакции",
        inputType: "text",
        buildDraft: ({ actor, occurredAt, inputValue }) => {
          const value = inputValue.trim();
          return {
            kind: "SOLID_FOOD",
            actor,
            occurredAt,
            summary: value ? `Прикорм — ${value}` : "Прикорм",
            payload: { food: value || "Прикорм" },
            status: "LOGGED",
          };
        },
      },
    ],
  },
  {
    id: "medication",
    kind: "MEDICATION",
    icon: "💊",
    title: "Лекарство",
    subtitle: "Список пустой — добавляйте назначения вручную",
    presets: [
      {
        id: "custom_medication",
        label: "Добавить лекарство",
        helper: "Название, дозировка и комментарий",
        defaultInput: "",
        inputLabel: "Лекарство и доза",
        inputPlaceholder: "Витамин D — 1 капля",
        inputType: "text",
        buildDraft: ({ actor, occurredAt, inputValue }) => {
          const value = inputValue.trim();
          const [namePart, ...doseParts] = value.split(/\s+[—-]\s+|,\s*/);
          const medication = namePart?.trim() || value || "Лекарство";
          const dose = doseParts.join(" ").trim() || "без дозы";
          return {
            kind: "MEDICATION",
            actor,
            occurredAt,
            summary: value ? `Лекарство — ${value}` : "Лекарство",
            payload: { medication, dose },
            status: "COMPLETED",
          };
        },
      },
    ],
  },
  {
    id: "note",
    kind: "NOTE",
    icon: "📝",
    title: "Заметка",
    subtitle: "Коротко одним предложением",
    presets: [
      {
        id: "note",
        label: "Короткая заметка",
        helper: "Например «плохо спал после 18:00»",
        defaultInput: "",
        inputLabel: "Текст",
        inputPlaceholder: "Одно короткое наблюдение",
        inputType: "text",
        buildDraft: ({ actor, occurredAt, inputValue }) => ({
          kind: "NOTE",
          actor,
          occurredAt,
          summary: inputValue || "Заметка без текста",
          payload: { note: inputValue || "Заметка без текста" },
          status: "LOGGED",
        }),
      },
    ],
  },
  {
    id: "growth",
    kind: "GROWTH",
    icon: "📏",
    title: "Вес и рост",
    subtitle: "Контроль динамики развития",
    presets: [
      {
        id: "growth",
        label: "Добавить измерение",
        helper: "Например: 4.2 кг, 54 см",
        fields: [
          {
            id: "weightKg",
            label: "Вес, кг",
            inputPlaceholder: "4.2",
            inputType: "number",
          },
          {
            id: "heightCm",
            label: "Рост, см",
            inputPlaceholder: "54",
            inputType: "number",
          },
        ],
        buildDraft: ({ actor, occurredAt, fieldValues }) => {
          const weightText = fieldValues.weightKg?.trim() ?? "";
          const heightText = fieldValues.heightCm?.trim() ?? "";
          const weightKg = weightText
            ? Number(weightText.replace(",", "."))
            : null;
          const heightCm = heightText
            ? Number(heightText.replace(",", "."))
            : null;
          const parts = [
            typeof weightKg === "number" && Number.isFinite(weightKg)
              ? `${weightKg} кг`
              : "",
            typeof heightCm === "number" && Number.isFinite(heightCm)
              ? `${heightCm} см`
              : "",
          ].filter(Boolean);
          const value = parts.join(", ");
          return {
            kind: "GROWTH",
            actor,
            occurredAt,
            summary: value ? `Вес и рост — ${value}` : "Вес и рост",
            payload: {
              note: value || "Измерение",
              weightKg:
                typeof weightKg === "number" && Number.isFinite(weightKg)
                  ? weightKg
                  : null,
              heightCm:
                typeof heightCm === "number" && Number.isFinite(heightCm)
                  ? heightCm
                  : null,
            },
            status: "LOGGED",
          };
        },
      },
    ],
  },
  {
    id: "walk",
    kind: "WALK",
    icon: "🌳",
    title: "Прогулка",
    subtitle: "Старт и финиш — длительность считается сама",
    presets: [
      {
        id: "walk_start",
        label: "Начали прогулку",
        helper: "",
        buildDraft: ({ actor, occurredAt }) => ({
          kind: "WALK",
          actor,
          occurredAt,
          summary: "Прогулка началась",
          payload: { phase: "START" },
          status: "STARTED",
        }),
      },
      {
        id: "walk_end",
        label: "Закончили прогулку",
        helper: "",
        buildDraft: ({ actor, occurredAt }) => ({
          kind: "WALK",
          actor,
          occurredAt,
          summary: "Прогулка завершена",
          payload: { phase: "END" },
          status: "COMPLETED",
        }),
      },
      {
        id: "walk_manual",
        label: "Записать вручную",
        helper: "",
        defaultInput: "30",
        inputLabel: "Минуты",
        inputType: "number",
        buildDraft: ({ actor, occurredAt, inputValue }) => {
          const durationMinutes = Math.max(1, Math.round(parseNumber(inputValue, 30)));
          return {
            kind: "WALK",
            actor,
            occurredAt,
            summary: `Прогулка — ${durationMinutes} мин`,
            payload: { phase: "END", durationMinutes },
            status: "COMPLETED",
          };
        },
      },
    ],
  },
  {
    id: "bath",
    kind: "BATH",
    icon: "🛁",
    title: "Купание",
    subtitle: "Сколько минут было купание",
    presets: [
      {
        id: "bath",
        label: "Записать купание",
        helper: "По умолчанию 10 минут",
        defaultInput: "10",
        inputLabel: "Минуты",
        inputType: "number",
        buildDraft: ({ actor, occurredAt, inputValue }) => {
          const durationMinutes = Math.max(1, Math.round(parseNumber(inputValue, 10)));
          return {
            kind: "BATH",
            actor,
            occurredAt,
            summary: `Купание — ${durationMinutes} мин`,
            payload: { durationMinutes },
            status: "LOGGED",
          };
        },
      },
    ],
  },
];

const actionOrder: ActionId[] = [
  "feeding",
  "diaper",
  "sleep",
  "walk",
  "temperature",
  "solid_food",
  "bath",
  "medication",
  "growth",
  "note",
];
const orderedActions = actionOrder
  .map((id) => actions.find((action) => action.id === id))
  .filter((action): action is ActionDefinition => Boolean(action));

function actionById(id: ActionId | null): ActionDefinition | undefined {
  return actions.find((action) => action.id === id);
}

function presetKey(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "") || "item"
  );
}

function getDefaultFieldValues(preset?: ActionPreset): Record<string, string> {
  return Object.fromEntries(
    (preset?.fields ?? []).map((field) => [field.id, field.defaultValue ?? ""]),
  );
}

function getEventFieldValues(event: CareEventRecord): Record<string, string> {
  if (event.kind !== "GROWTH") {
    return {};
  }

  return {
    weightKg: event.payload.weightKg ? String(event.payload.weightKg) : "",
    heightCm: event.payload.heightCm ? String(event.payload.heightCm) : "",
  };
}

function isFiniteNumericInput(value: string) {
  return Number.isFinite(Number(value.trim().replace(",", ".")));
}

/** Безопасно парсит число с поддержкой запятой; возвращает fallback на NaN/пусто. */
function parseNumber(value: string | undefined, fallback: number): number {
  const text = (value ?? "").trim().replace(",", ".");
  if (!text) return fallback;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Шаг и форматирование stepper-кнопок для числового ввода в форме.
 * Подбирается так, чтобы один тап давал осмысленную дельту:
 * температура — 0.1°, мл — 10, минуты — 5, остальное — 1.
 */
function getStepperConfig(
  action: ActionDefinition | undefined,
  preset: ActionPreset | undefined,
): {
  step: number;
  min: number;
  max: number;
  precision: number;
} | null {
  if (!action || !preset || preset.inputType !== "number") return null;
  if (action.id === "temperature") {
    return { step: 0.1, min: 30, max: 43, precision: 1 };
  }
  if (action.id === "feeding" && preset.id === "breast") {
    // длительность кормления в минутах
    return { step: 5, min: 1, max: 180, precision: 0 };
  }
  if (action.id === "feeding") {
    // мл бутылочки/сцеженное
    return { step: 10, min: 1, max: 500, precision: 0 };
  }
  if (action.id === "walk" || action.id === "bath") {
    return { step: 5, min: 1, max: 240, precision: 0 };
  }
  return { step: 1, min: 0, max: 9999, precision: 1 };
}

/** Применяет дельту к числовому значению input'а с учётом точности и границ. */
function applyStepperDelta(
  current: string,
  delta: number,
  config: { step: number; min: number; max: number; precision: number },
  fallback: number,
): string {
  const value = parseNumber(current, fallback);
  const next = Math.min(
    config.max,
    Math.max(config.min, value + delta * config.step),
  );
  return config.precision === 0
    ? String(Math.round(next))
    : next.toFixed(config.precision).replace(/\.?0+$/, "");
}

function getSubmitValidationMessage(
  action: ActionDefinition | undefined,
  preset: ActionPreset | undefined,
  inputValue: string,
  fieldValues: Record<string, string>,
) {
  if (!action || !preset) {
    return "Выберите действие.";
  }

  const text = inputValue.trim();
  if (
    (action.id === "note" ||
      (action.id === "solid_food" && preset.inputLabel) ||
      (action.id === "medication" && preset.inputLabel)) &&
    !text
  ) {
    return action.id === "note"
      ? "Введите короткую заметку."
      : action.id === "solid_food"
        ? "Введите прикорм или реакцию."
        : "Введите лекарство или дозировку.";
  }

  if (preset.inputType === "number" && text && !isFiniteNumericInput(text)) {
    return "Введите корректное число.";
  }

  if (
    action.id === "growth" &&
    !fieldValues.weightKg?.trim() &&
    !fieldValues.heightCm?.trim()
  ) {
    return "Укажите вес или рост.";
  }

  return "";
}

function eventKindLabel(kind: CareEventKind): string {
  switch (kind) {
    case "FEEDING":
      return "Кормление";
    case "SOLID_FOOD":
      return "Прикорм";
    case "SLEEP":
      return "Сон";
    case "DIAPER":
      return "Подгузник";
    case "TEMPERATURE":
      return "Температура";
    case "MEDICATION":
      return "Лекарство";
    case "GROWTH":
      return "Вес и рост";
    case "WALK":
      return "Прогулка";
    case "BATH":
      return "Купание";
    case "NOTE":
    default:
      return "Заметка";
  }
}

function eventIcon(kind: CareEventKind): string {
  return actions.find((action) => action.kind === kind)?.icon ?? "•";
}

const TZ_MOSCOW = "Europe/Moscow";

/** Достаёт численные части даты в часовом поясе Москвы. */
function moscowParts(date: Date): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_MOSCOW,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA → "YYYY-MM-DD"
  const [year, month, day] = fmt.format(date).split("-").map(Number);
  return { year, month, day };
}

/** Начало дня (00:00) в Москве для произвольной даты. */
function moscowStartOfDay(date: Date): Date {
  const { year, month, day } = moscowParts(date);
  // 00:00 МСК = 21:00 предыдущих суток UTC (UTC+3)
  return new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0));
}

function dayKey(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TZ_MOSCOW,
  }).format(new Date(value));
}

function dayTitle(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ_MOSCOW,
  }).format(new Date(value));
}

/** Преобразует Date в значение для <input type="date"> по дате в МСК. */
function toDateInputValue(date: Date): string {
  const { year, month, day } = moscowParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Конец дня (23:59:59.999) в Москве. */
function dateInputToDayEnd(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return moscowStartOfDay(new Date());
  }
  // 23:59:59.999 МСК = 20:59:59.999 UTC
  return new Date(Date.UTC(year, month - 1, day, 20, 59, 59, 999));
}

function dateInputToLabel(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ_MOSCOW,
  }).format(dateInputToDayEnd(value));
}

function periodRangeEnd(value: string): number {
  return dateInputToDayEnd(value).getTime();
}

function periodRangeStart(days: number | null, value: string): number {
  if (days === null) {
    return Number.NEGATIVE_INFINITY;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return Number.NEGATIVE_INFINITY;
  }
  // Старт окна = 00:00 МСК даты (end - days + 1)
  // 00:00 МСК = -3:00 UTC того же дня
  const endDayStartUTC = Date.UTC(year, month - 1, day, -3, 0, 0, 0);
  return endDayStartUTC - (days - 1) * 86_400_000;
}

function buildSummaryForDate(
  events: CareEventRecord[],
  period: PeriodSummary,
  dateValue: string,
): PeriodSummary {
  const start = periodRangeStart(period.days, dateValue);
  const end = periodRangeEnd(dateValue);
  const periodEvents = events.filter((event) => {
    const timestamp = new Date(event.occurredAt).getTime();
    return timestamp >= start && timestamp <= end;
  });
  const feedingEvents = periodEvents
    .filter((event) => event.kind === "FEEDING")
    .sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() -
        new Date(right.occurredAt).getTime(),
    );
  const diaperEvents = periodEvents.filter((event) => event.kind === "DIAPER");
  const sleepStarts = periodEvents
    .filter(
      (event) => event.kind === "SLEEP" && event.payload.phase === "START",
    )
    .sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() -
        new Date(right.occurredAt).getTime(),
    );
  const sleepEnds = periodEvents
    .filter((event) => event.kind === "SLEEP" && event.payload.phase === "END")
    .sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() -
        new Date(right.occurredAt).getTime(),
    );

  let totalSleepMinutes = 0;
  sleepStarts.forEach((startEvent, index) => {
    const endEvent = sleepEnds[index];
    const endTime = endEvent
      ? new Date(endEvent.occurredAt).getTime()
      : Math.min(Date.now(), end);
    totalSleepMinutes += Math.max(
      0,
      Math.round((endTime - new Date(startEvent.occurredAt).getTime()) / 60000),
    );
  });

  let intervalSum = 0;
  for (let index = 1; index < feedingEvents.length; index += 1) {
    intervalSum += Math.abs(
      Math.round(
        (new Date(feedingEvents[index].occurredAt).getTime() -
          new Date(feedingEvents[index - 1].occurredAt).getTime()) /
          60000,
      ),
    );
  }

  const walkEvents = periodEvents.filter((event) => event.kind === "WALK");
  const bathEvents = periodEvents.filter((event) => event.kind === "BATH");
  const totalWalkMinutes = sumWalkMinutes(walkEvents, end);
  const totalBathMinutes = bathEvents.reduce(
    (sum, event) =>
      sum + Math.max(0, Number(event.payload.durationMinutes ?? 0)),
    0,
  );
  const feedingsTotalMl = feedingEvents.reduce((sum, event) => {
    const volume = Number(event.payload.volumeMl ?? 0);
    return sum + (Number.isFinite(volume) ? volume : 0);
  }, 0);
  const breastFeedingCount = feedingEvents.filter(
    (event) => event.payload.mode === "BREAST",
  ).length;
  const bottleFeedingCount = feedingEvents.filter(
    (event) =>
      event.payload.mode === "BOTTLE" || event.payload.mode === "BREAST_BOTTLE",
  ).length;
  const breastMilkBottleCount = feedingEvents.filter(
    (event) => event.payload.mode === "BREAST_BOTTLE",
  ).length;
  const diaperChangedCount = diaperEvents.filter(
    (event) => event.payload.changed !== false,
  ).length;
  const diaperCheckedOnlyCount = diaperEvents.length - diaperChangedCount;

  const summary: DailySummary = {
    dateLabel: dateInputToLabel(dateValue),
    feedingsCount: feedingEvents.length,
    feedingsTotalMl: Math.round(feedingsTotalMl),
    feedingsBreastCount: breastFeedingCount,
    feedingsBottleCount: bottleFeedingCount,
    feedingsBreastMilkBottleCount: breastMilkBottleCount,
    solidFoodsCount: periodEvents.filter((event) => event.kind === "SOLID_FOOD")
      .length,
    totalSleepMinutes,
    averageFeedingIntervalMinutes:
      feedingEvents.length > 1
        ? Math.round(intervalSum / (feedingEvents.length - 1))
        : 0,
    diaperChangedCount,
    diaperCheckedOnlyCount,
    diaperWetCount: diaperEvents.filter((event) => event.payload.type === "WET")
      .length,
    diaperDirtyCount: diaperEvents.filter(
      (event) => event.payload.type === "DIRTY",
    ).length,
    diaperMixedCount: diaperEvents.filter(
      (event) => event.payload.type === "MIXED",
    ).length,
    temperatureReadingsCount: periodEvents.filter(
      (event) => event.kind === "TEMPERATURE",
    ).length,
    medicationsCount: periodEvents.filter(
      (event) => event.kind === "MEDICATION",
    ).length,
    growthReadingsCount: periodEvents.filter((event) => event.kind === "GROWTH")
      .length,
    walkSessionsCount: walkEvents.filter(
      (event) => event.payload.phase === "END",
    ).length,
    totalWalkMinutes,
    bathSessionsCount: bathEvents.length,
    totalBathMinutes,
  };

  return {
    ...summary,
    id: period.id,
    title: period.title,
    days: period.days,
  };
}

/** Считает минуты прогулок по парам START/END в пределах окна периода. */
function sumWalkMinutes(events: CareEventRecord[], periodEnd: number): number {
  const starts = events
    .filter((event) => event.payload.phase === "START")
    .sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() -
        new Date(right.occurredAt).getTime(),
    );
  const ends = events
    .filter((event) => event.payload.phase === "END")
    .sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() -
        new Date(right.occurredAt).getTime(),
    );

  let total = 0;
  starts.forEach((startEvent, index) => {
    const endEvent = ends[index];
    const endTime = endEvent
      ? new Date(endEvent.occurredAt).getTime()
      : Math.min(Date.now(), periodEnd);
    total += Math.max(
      0,
      Math.round(
        (endTime - new Date(startEvent.occurredAt).getTime()) / 60000,
      ),
    );
  });

  // События с уже посчитанной длительностью (ручной ввод "Записать вручную")
  events
    .filter(
      (event) =>
        event.payload.phase !== "START" &&
        Number(event.payload.durationMinutes ?? 0) > 0,
    )
    .forEach((event) => {
      // если это END с durationMinutes — длительность уже посчитана через пары,
      // поэтому такие события не дублируем
      const isPairedEnd =
        event.payload.phase === "END" &&
        starts.some(
          (start, index) =>
            ends[index] && ends[index].id === event.id,
        );
      if (isPairedEnd) {
        return;
      }
      total += Math.max(0, Number(event.payload.durationMinutes ?? 0));
    });

  return total;
}

function getNumberPayload(
  event: CareEventRecord,
  key: "weightKg" | "heightCm",
): number | null {
  const value = event.payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getGrowthReadings(events: CareEventRecord[]): GrowthReading[] {
  return events
    .filter((event) => event.kind === "GROWTH")
    .map((event) => ({
      id: event.id,
      label: new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(event.occurredAt)),
      occurredAt: event.occurredAt,
      weightKg: getNumberPayload(event, "weightKg"),
      heightCm: getNumberPayload(event, "heightCm"),
    }))
    .filter((reading) => reading.weightKg !== null || reading.heightCm !== null)
    .sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() -
        new Date(right.occurredAt).getTime(),
    );
}

function growthMetricLabel(key: GrowthMetricKey): string {
  return key === "weightKg" ? "Вес" : "Рост";
}

function growthMetricUnit(key: GrowthMetricKey): string {
  return key === "weightKg" ? "кг" : "см";
}

function formatGrowthValue(value: number | null, key: GrowthMetricKey): string {
  if (value === null) {
    return "нет";
  }

  return key === "weightKg"
    ? `${value.toFixed(2).replace(".", ",")} кг`
    : `${Math.round(value)} см`;
}

function formatGrowthDelta(value: number | null, key: GrowthMetricKey): string {
  if (value === null) {
    return "первое измерение";
  }

  const sign = value > 0 ? "+" : "";
  if (Math.abs(value) < 0.01) {
    return `без изменений`;
  }

  return key === "weightKg"
    ? `${sign}${value.toFixed(2).replace(".", ",")} кг`
    : `${sign}${Math.round(value)} см`;
}

function growthMetricValues(readings: GrowthReading[], key: GrowthMetricKey) {
  return readings
    .map((reading) => ({
      id: reading.id,
      label: reading.label,
      occurredAt: reading.occurredAt,
      value: reading[key],
    }))
    .filter(
      (
        item,
      ): item is {
        id: string;
        label: string;
        occurredAt: string;
        value: number;
      } => item.value !== null,
    );
}

// Размеры SVG-чарта для GrowthMetricPanel.
// Используем общие константы, чтобы tooltip и оси были выровнены идеально.
const GROWTH_CHART = {
  width: 320,
  height: 160,
  padX: 22,
  padTop: 18,
  padBottom: 32,
} as const;

function growthSeriesPoints(
  readings: GrowthReading[],
  key: GrowthMetricKey,
): Array<{ x: number; y: number; value: number; label: string; occurredAt: string }> {
  const metricValues = growthMetricValues(readings, key);
  const values = metricValues.map((item) => item.value);

  if (!values.length) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const { width, height, padX, padTop, padBottom } = GROWTH_CHART;
  // Если все значения равны — даём искусственный «диапазон» 4%, чтобы линия
  // не липла к верхней границе и читалась горизонтально по центру.
  const range = max - min || Math.max(0.01, max * 0.04);
  // Если все значения равны, показываем линию по центру высоты:
  const allEqual = max === min;

  return metricValues.map((reading, index) => {
    const x =
      metricValues.length === 1
        ? width / 2
        : padX + (index / (metricValues.length - 1)) * (width - padX * 2);
    const innerH = height - padTop - padBottom;
    const y = allEqual
      ? padTop + innerH / 2
      : padTop + (1 - (reading.value - min) / range) * innerH;
    return {
      x,
      y,
      value: reading.value,
      label: reading.label,
      occurredAt: reading.occurredAt,
    };
  });
}

/**
 * Строит smooth (Catmull-Rom → bezier) SVG-path по массиву точек.
 * Tension 0.5 — плавно, без overshoot. Используется для линии графика.
 */
function buildSmoothPath(
  points: Array<{ x: number; y: number }>,
  tension = 0.5,
): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  const t = tension / 6;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) * t;
    const cp1y = p1.y + (p2.y - p0.y) * t;
    const cp2x = p2.x - (p3.x - p1.x) * t;
    const cp2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function buildAreaPath(
  points: Array<{ x: number; y: number }>,
  baselineY: number,
  tension = 0.5,
): string {
  if (points.length === 0) return "";
  const top = buildSmoothPath(points, tension);
  return `${top} L ${points.at(-1)!.x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
}

/** Форматирует период между первым и последним замером в человеко-читаемый текст. */
function formatGrowthSpan(readings: GrowthReading[]): string {
  if (readings.length < 2) return "";
  const first = new Date(readings[0].occurredAt).getTime();
  const last = new Date(readings.at(-1)!.occurredAt).getTime();
  const days = Math.max(1, Math.round((last - first) / 86_400_000));
  if (days < 14) return `за ${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"}`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `за ${weeks} ${weeks === 1 ? "неделю" : weeks < 5 ? "недели" : "недель"}`;
  const months = Math.round(days / 30);
  return `за ${months} ${months === 1 ? "месяц" : months < 5 ? "месяца" : "месяцев"}`;
}

/** Период фильтра графика. */
type GrowthRange = "7d" | "30d" | "all";

function filterGrowthByRange(
  readings: GrowthReading[],
  range: GrowthRange,
): GrowthReading[] {
  if (range === "all") return readings;
  const now = Date.now();
  const days = range === "7d" ? 7 : 30;
  const start = now - days * 86_400_000;
  return readings.filter(
    (reading) => new Date(reading.occurredAt).getTime() >= start,
  );
}

function GrowthMetricPanel({
  readings,
  metricKey,
}: {
  readings: GrowthReading[];
  metricKey: GrowthMetricKey;
}) {
  const values = growthMetricValues(readings, metricKey);
  const latest = values.at(-1);
  const previous = values.at(-2);
  const delta = latest && previous ? latest.value - previous.value : null;
  const min = values.length
    ? Math.min(...values.map((item) => item.value))
    : null;
  const max = values.length
    ? Math.max(...values.map((item) => item.value))
    : null;
  const points = growthSeriesPoints(readings, metricKey);
  const tone = metricKey === "weightKg" ? "weight" : "height";
  const title = growthMetricLabel(metricKey);
  const { width, height, padTop, padBottom, padX } = GROWTH_CHART;
  const baselineY = height - padBottom;
  // Smooth bezier-path и area-fill
  const linePath = buildSmoothPath(points);
  const areaPath = buildAreaPath(points, baselineY);
  // Активная точка — по умолчанию последняя; меняется при hover/touch.
  const [activeIndex, setActiveIndex] = useState<number>(
    points.length ? points.length - 1 : 0,
  );
  // При смене readings (например, после переключения периода) вернёмся
  // к последней точке.
  useEffect(() => {
    if (points.length === 0) return;
    setActiveIndex(points.length - 1);
    // Зависим только от длины серии, чтобы не скакать при ре-рендерах
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length, metricKey]);

  const trend =
    delta === null
      ? "neutral"
      : Math.abs(delta) < 0.01
        ? "neutral"
        : delta > 0
          ? "up"
          : "down";

  const activePoint = points[activeIndex] ?? points.at(-1) ?? null;

  /**
   * Конвертирует горизонтальную координату курсора/тача в индекс
   * ближайшей точки серии. Используется для interactive scrubbing.
   */
  const handleScrub = (clientX: number, svg: SVGSVGElement) => {
    if (!points.length) return;
    const rect = svg.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;
    const svgX = Math.max(0, Math.min(width, ratio * width));
    let bestIdx = 0;
    let bestDist = Infinity;
    points.forEach((point, idx) => {
      const dist = Math.abs(point.x - svgX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    setActiveIndex(bestIdx);
  };

  // Подписи Y-оси: max сверху, средний посередине, min снизу
  const yMaxY = padTop;
  const yMidY = padTop + (height - padTop - padBottom) / 2;
  const yMinY = baselineY;

  // Tooltip позиционируется относительно activePoint, но не вылезает за края.
  const tooltipPositionLeft = activePoint
    ? Math.max(8, Math.min(width - 8, activePoint.x))
    : width / 2;

  return (
    <Surface className={`growth-panel growth-panel-${tone}`}>
      <div className="growth-panel-head">
        <div className="growth-panel-headline">
          <div className="growth-panel-label">{title}</div>
          <div className="growth-panel-value">
            {formatGrowthValue(latest?.value ?? null, metricKey)}
          </div>
          {values.length ? (
            <div className={`growth-panel-trend trend-${trend}`}>
              <span aria-hidden="true">
                {trend === "up" ? "↗" : trend === "down" ? "↘" : "→"}
              </span>
              <span>{formatGrowthDelta(delta, metricKey)}</span>
              {previous ? (
                <span className="growth-panel-trend-meta">
                  с {previous.label}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {values.length ? (
          <div className="growth-panel-extremes" aria-hidden="true">
            <span className="growth-panel-extreme">
              <span>min</span>
              <strong>{formatGrowthValue(min, metricKey)}</strong>
            </span>
            <span className="growth-panel-extreme">
              <span>max</span>
              <strong>{formatGrowthValue(max, metricKey)}</strong>
            </span>
          </div>
        ) : null}
      </div>
      {values.length ? (
        <>
          <div className="growth-chart-stage">
            <svg
              className="growth-chart-svg"
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${title}: ${formatGrowthValue(latest?.value ?? null, metricKey)}`}
              onPointerMove={(event) => {
                if (event.pointerType === "mouse" && event.buttons === 0) {
                  handleScrub(event.clientX, event.currentTarget);
                }
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                handleScrub(event.clientX, event.currentTarget);
              }}
              onPointerLeave={() => {
                if (points.length) setActiveIndex(points.length - 1);
              }}
            >
              <defs>
                <linearGradient
                  id={`growth-fill-${tone}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="currentColor"
                    stopOpacity="0.42"
                  />
                  <stop
                    offset="60%"
                    stopColor="currentColor"
                    stopOpacity="0.10"
                  />
                  <stop
                    offset="100%"
                    stopColor="currentColor"
                    stopOpacity="0"
                  />
                </linearGradient>
                <linearGradient
                  id={`growth-line-${tone}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
                </linearGradient>
                <filter
                  id={`growth-glow-${tone}`}
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Y-axis labels: max / mid / min */}
              <g className="growth-chart-yaxis" aria-hidden="true">
                <text x={padX - 6} y={yMaxY + 4} textAnchor="end">
                  {formatGrowthValue(max, metricKey)}
                </text>
                {max !== min ? (
                  <text x={padX - 6} y={yMidY + 4} textAnchor="end">
                    {formatGrowthValue(
                      ((max ?? 0) + (min ?? 0)) / 2,
                      metricKey,
                    )}
                  </text>
                ) : null}
                <text x={padX - 6} y={yMinY + 4} textAnchor="end">
                  {formatGrowthValue(min, metricKey)}
                </text>
              </g>

              {/* Horizontal grid */}
              <g className="growth-chart-grid" aria-hidden="true">
                <line x1={padX} y1={yMaxY} x2={width - padX} y2={yMaxY} />
                {max !== min ? (
                  <line x1={padX} y1={yMidY} x2={width - padX} y2={yMidY} />
                ) : null}
                <line x1={padX} y1={yMinY} x2={width - padX} y2={yMinY} />
              </g>

              {/* Vertical guide for active point */}
              {activePoint ? (
                <line
                  className="growth-chart-guide"
                  x1={activePoint.x}
                  y1={padTop}
                  x2={activePoint.x}
                  y2={baselineY}
                />
              ) : null}

              {/* Area fill */}
              {points.length > 1 ? (
                <path d={areaPath} fill={`url(#growth-fill-${tone})`} />
              ) : null}

              {/* Smooth line */}
              {points.length > 1 ? (
                <path
                  className="growth-chart-line"
                  d={linePath}
                  stroke={`url(#growth-line-${tone})`}
                  filter={`url(#growth-glow-${tone})`}
                  fill="none"
                />
              ) : null}

              {/* Static dots */}
              {points.map((point, idx) => (
                <circle
                  key={`${metricKey}-${point.occurredAt}-${idx}`}
                  className={`growth-chart-dot ${idx === activeIndex ? "is-active" : ""}`}
                  cx={point.x}
                  cy={point.y}
                  r={idx === activeIndex ? 6 : points.length === 1 ? 6 : 4}
                />
              ))}

              {/* Pulse halo for active point */}
              {activePoint ? (
                <circle
                  className="growth-chart-halo"
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="14"
                />
              ) : null}
            </svg>

            {/* HTML-tooltip пристёгнут к activePoint, корректно работает с touch */}
            {activePoint ? (
              <div
                className="growth-chart-tooltip"
                style={{
                  left: `${(tooltipPositionLeft / width) * 100}%`,
                  top: `${(activePoint.y / height) * 100}%`,
                }}
                role="status"
                aria-live="polite"
              >
                <span className="growth-chart-tooltip-value">
                  {formatGrowthValue(activePoint.value, metricKey)}
                </span>
                <span className="growth-chart-tooltip-date">
                  {activePoint.label}
                </span>
              </div>
            ) : null}
          </div>
          <div className="growth-axis-row">
            <span>{values[0]?.label}</span>
            <span className="growth-axis-center">
              {values.length}{" "}
              {values.length === 1
                ? "замер"
                : values.length < 5
                  ? "замера"
                  : "замеров"}
              {values.length > 1 ? ` · ${formatGrowthSpan(readings)}` : ""}
            </span>
            <span>{values.at(-1)?.label}</span>
          </div>
        </>
      ) : (
        <div className="growth-panel-empty">
          Нет данных по {growthMetricUnit(metricKey)}.
        </div>
      )}
    </Surface>
  );
}

/**
 * Универсальная карточка периода со списком строк-метрик.
 * Используется для подгузников / сна / прогулок / купания,
 * где есть одна крупная цифра + 1-3 строки разбивки.
 */
type PeriodCardTone = "day" | "week" | "month";
type PeriodCardCategory =
  | "diaper"
  | "sleep"
  | "walk"
  | "bath"
  | "feeding";

interface PeriodCardRow {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  meta?: string;
  /** data-source для row-color */
  source?: string;
}

function PeriodCard({
  category,
  tone,
  period,
  headIcon,
  headValue,
  headUnit,
  emptyText,
  rows,
}: {
  category: PeriodCardCategory;
  tone: PeriodCardTone;
  period: string;
  headIcon: string;
  headValue: string;
  headUnit?: string;
  emptyText: string;
  rows: PeriodCardRow[];
}) {
  const visibleRows = rows.filter((row) => row.value !== "" && row.value !== "0");
  const isEmpty = visibleRows.length === 0;
  return (
    <div
      className={`feeding-card period-card period-${category} period-${category}-${tone}`}
    >
      <div className="feeding-card-head">
        <span className="feeding-card-icon" aria-hidden="true">
          {headIcon}
        </span>
        <div className="feeding-card-period">{period}</div>
        <div className="feeding-card-count">
          {headValue}
          {headUnit ? (
            <span className="feeding-card-count-unit">{headUnit}</span>
          ) : null}
        </div>
      </div>
      {isEmpty ? (
        <div className="feeding-card-empty">{emptyText}</div>
      ) : (
        <ul className="feeding-card-rows" role="list">
          {visibleRows.map((row, idx) => (
            <li
              key={`${row.label}-${idx}`}
              className="feeding-row"
              data-source={row.source ?? category}
            >
              <span className="feeding-row-icon" aria-hidden="true">
                {row.icon}
              </span>
              <span className="feeding-row-label">{row.label}</span>
              <span className="feeding-row-value">
                {row.value}
                {row.unit ? (
                  <span className="feeding-row-unit">{row.unit}</span>
                ) : null}
              </span>
              {row.meta ? (
                <span className="feeding-row-meta">{row.meta}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Карточка одного периода кормления (День / Неделя / Месяц).
 * Внутри 3 строки разбивки: грудь (минуты), смесь (мл), сцеженное (мл).
 * Если ни одной нет — показываем placeholder вместо пустых нулей.
 */
function FeedingPeriodCard({
  period,
  stats,
  tone,
}: {
  period: string;
  stats: {
    count: number;
    breastCount: number;
    breastMinutes: number;
    bottleCount: number;
    formulaMl: number;
    breastMilkMl: number;
    totalMl: number;
  };
  tone: "day" | "week" | "month";
}) {
  const breastShown = stats.breastCount > 0;
  const breastMilkShown = stats.breastMilkMl > 0;
  const formulaShown = stats.formulaMl > 0;
  const isEmpty = stats.count === 0;
  const periodIcon = tone === "day" ? "🍼" : tone === "week" ? "📅" : "📆";

  return (
    <div className={`feeding-card feeding-card-${tone}`}>
      <div className="feeding-card-head">
        <span className="feeding-card-icon" aria-hidden="true">
          {periodIcon}
        </span>
        <div className="feeding-card-period">{period}</div>
        <div className="feeding-card-count" aria-label={`Всего кормлений: ${stats.count}`}>
          {stats.count}
          <span className="feeding-card-count-unit">кормл.</span>
        </div>
      </div>

      {isEmpty ? (
        <div className="feeding-card-empty">записей нет</div>
      ) : (
        <ul className="feeding-card-rows" role="list">
          {breastShown ? (
            <li className="feeding-row" data-source="breast">
              <span className="feeding-row-icon" aria-hidden="true">🤱</span>
              <span className="feeding-row-label">Грудь</span>
              <span className="feeding-row-value">
                {formatDuration(stats.breastMinutes)}
              </span>
              <span className="feeding-row-meta">
                {stats.breastCount}{" "}
                {stats.breastCount === 1 ? "раз" : "раза"}
              </span>
            </li>
          ) : null}

          {breastMilkShown ? (
            <li className="feeding-row" data-source="breast-milk">
              <span className="feeding-row-icon" aria-hidden="true">💧</span>
              <span className="feeding-row-label">Сцеженное</span>
              <span className="feeding-row-value">
                {stats.breastMilkMl}
                <span className="feeding-row-unit">мл</span>
              </span>
              <span className="feeding-row-meta">
                {/* кол-во бутылочек со сцеженным = тех, что не formula */}
                {/* totalBottles - formulaCount; здесь приближение через
                    bottleCount, если formulaShown без формулы — оставим */}
                {stats.bottleCount}{" "}
                {stats.bottleCount === 1 ? "бут." : "бут."}
              </span>
            </li>
          ) : null}

          {formulaShown ? (
            <li className="feeding-row" data-source="formula">
              <span className="feeding-row-icon" aria-hidden="true">🍼</span>
              <span className="feeding-row-label">Смесь</span>
              <span className="feeding-row-value">
                {stats.formulaMl}
                <span className="feeding-row-unit">мл</span>
              </span>
              <span className="feeding-row-meta">
                {stats.bottleCount}{" "}
                {stats.bottleCount === 1 ? "бут." : "бут."}
              </span>
            </li>
          ) : null}

          {breastMilkShown || formulaShown ? (
            <li className="feeding-row feeding-row-total" data-source="total">
              <span className="feeding-row-label">Итого жидкости</span>
              <span className="feeding-row-value">
                {stats.totalMl}
                <span className="feeding-row-unit">мл</span>
              </span>
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

function GrowthChart({ readings }: { readings: GrowthReading[] }) {
  const [range, setRange] = useState<GrowthRange>("all");
  const filteredReadings = filterGrowthByRange(readings, range);
  const latestWeight = [...filteredReadings]
    .reverse()
    .find((reading) => reading.weightKg !== null);
  const latestHeight = [...filteredReadings]
    .reverse()
    .find((reading) => reading.heightCm !== null);
  const lastDate = filteredReadings.length
    ? filteredReadings.at(-1)?.label
    : readings.at(-1)?.label;

  return (
    <Card className="growth-card">
      <SectionTitle
        title="Вес и рост"
        action={
          readings.length > 0 ? (
            <div
              className="growth-range-tabs"
              role="tablist"
              aria-label="Период графика"
            >
              {(
                [
                  { id: "7d" as const, label: "Неделя" },
                  { id: "30d" as const, label: "Месяц" },
                  { id: "all" as const, label: "Всё" },
                ] satisfies Array<{ id: GrowthRange; label: string }>
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={range === option.id}
                  className={
                    range === option.id
                      ? "growth-range-tab active"
                      : "growth-range-tab"
                  }
                  onClick={() => setRange(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : undefined
        }
      />
      {filteredReadings.length ? (
        <>
          <div className="growth-summary-bar" aria-live="polite">
            <div className="growth-summary-stat">
              <span className="growth-summary-stat-label">Последний замер</span>
              <span className="growth-summary-stat-value">
                {lastDate ?? "—"}
              </span>
            </div>
            <div className="growth-summary-stat">
              <span className="growth-summary-stat-label">Замеров в периоде</span>
              <span className="growth-summary-stat-value">
                {filteredReadings.length}
              </span>
            </div>
          </div>
          <div className="growth-panel-grid">
            <GrowthMetricPanel
              readings={filteredReadings}
              metricKey="weightKg"
            />
            <GrowthMetricPanel
              readings={filteredReadings}
              metricKey="heightCm"
            />
          </div>
          {latestWeight && latestHeight ? (
            <div className="growth-current-row">
              <span className="growth-current-pill">
                Сейчас:{" "}
                {formatGrowthValue(latestWeight.weightKg, "weightKg")} ·{" "}
                {formatGrowthValue(latestHeight.heightCm, "heightCm")}
              </span>
            </div>
          ) : null}
        </>
      ) : readings.length === 0 ? (
        <EmptyState
          title="Измерений пока нет"
          description="После записи веса или роста здесь появится динамика."
        />
      ) : (
        <EmptyState
          title="В этом периоде нет замеров"
          description="Переключите фильтр на «Всё», чтобы увидеть всю историю."
        />
      )}
    </Card>
  );
}

function getHistoryPresets(
  action: ActionDefinition,
  quickItems: QuickItemRecord[],
): ActionPreset[] {
  if (action.id === "solid_food") {
    const foods = quickItems
      .filter((item) => item.kind === "SOLID_FOOD")
      .slice(0, 8);

    return foods.map((item) => ({
      id: `food_${presetKey(item.label)}`,
      label: item.label,
      helper: "Быстрая кнопка из семейного списка",
      quickItem: {
        kind: item.kind,
        key: item.key,
        label: item.label,
      },
      buildDraft: ({ actor, occurredAt }) => ({
        kind: "SOLID_FOOD",
        actor,
        occurredAt,
        summary: `Прикорм — ${item.label}`,
        payload: { food: item.label },
        status: "LOGGED",
      }),
    }));
  }

  if (action.id === "medication") {
    return quickItems
      .filter((item) => item.kind === "MEDICATION")
      .slice(0, 8)
      .map((item) => ({
        id: `med_${presetKey(item.label)}`,
        label: item.label,
        helper: item.detail
          ? `Быстро: ${item.detail}`
          : "Быстрая кнопка из семейного списка",
        quickItem: {
          kind: item.kind,
          key: item.key,
          label: item.label,
        },
        buildDraft: ({ actor, occurredAt }) => ({
          kind: "MEDICATION",
          actor,
          occurredAt,
          summary: item.detail
            ? `Лекарство — ${item.label}, ${item.detail}`
            : `Лекарство — ${item.label}`,
          payload: { medication: item.label, dose: item.detail || "без дозы" },
          status: "COMPLETED",
        }),
      }));
  }

  return [];
}

function getActionPresets(
  action: ActionDefinition,
  actor: ActorId,
  quickItems: QuickItemRecord[],
): ActionPreset[] {
  return [
    ...getHistoryPresets(action, quickItems),
    ...action.presets.filter(
      (preset) => !preset.hiddenForActors?.includes(actor),
    ),
  ];
}

function actionSubtitle(action: ActionDefinition, actor: ActorId): string {
  if (action.id === "feeding" && actor === "dad") {
    return "Бутылочка";
  }

  return action.subtitle;
}

function resolveActionId(kind: CareEventKind): ActionId {
  switch (kind) {
    case "FEEDING":
      return "feeding";
    case "SOLID_FOOD":
      return "solid_food";
    case "SLEEP":
      return "sleep";
    case "DIAPER":
      return "diaper";
    case "TEMPERATURE":
      return "temperature";
    case "MEDICATION":
      return "medication";
    case "GROWTH":
      return "growth";
    case "WALK":
      return "walk";
    case "BATH":
      return "bath";
    case "NOTE":
    default:
      return "note";
  }
}

function resolvePresetId(event: CareEventRecord): string {
  switch (event.kind) {
    case "FEEDING":
      return event.payload.mode === "BREAST_BOTTLE"
        ? "breast_bottle"
        : event.payload.mode === "BOTTLE"
          ? "bottle"
          : "breast";
    case "SOLID_FOOD":
      return "solid_food";
    case "SLEEP":
      return event.payload.phase === "END" ? "sleep_end" : "sleep_start";
    case "DIAPER":
      return event.payload.type === "DIRTY"
        ? "dirty"
        : event.payload.type === "MIXED"
          ? "mixed"
          : event.payload.type === "DRY_CHECK"
            ? // legacy события с DRY_CHECK: пробуем восстановить наблюдение
              (event.payload.observed === "DIRTY"
                ? "dirty"
                : event.payload.observed === "MIXED"
                  ? "mixed"
                  : "wet")
            : "wet";
    case "TEMPERATURE":
      return "temperature";
    case "MEDICATION":
      return "custom_medication";
    case "GROWTH":
      return "growth";
    case "WALK":
      return event.payload.phase === "START"
        ? "walk_start"
        : Number(event.payload.durationMinutes ?? 0) > 0
          ? "walk_manual"
          : "walk_end";
    case "BATH":
      return "bath";
    case "NOTE":
    default:
      return "note";
  }
}

function toTimeInput(value: string): string {
  // Время события в часовом поясе Москвы — независимо от локального TZ
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}

function combineDateAndTime(dateValue: string, timeValue: string): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);

  // Интерпретируем выбранное время в часовом поясе Москвы (UTC+3),
  // чтобы запись была одинаковой для родителей в любой TZ устройства.
  const safeYear = year || new Date().getUTCFullYear();
  const safeMonth = month ? month - 1 : new Date().getUTCMonth();
  const safeDay = day || new Date().getUTCDate();
  const h = Number.isFinite(hours) ? hours : 0;
  const m = Number.isFinite(minutes) ? minutes : 0;
  // 14:30 МСК = 11:30 UTC. UTC = МСК - 3
  return new Date(
    Date.UTC(safeYear, safeMonth, safeDay, h - 3, m, 0, 0),
  ).toISOString();
}

/** Текущее время в формате HH:MM по Москве — для дефолта в форме. */
function moscowNowTimeString(): string {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Moscow",
  }).format(new Date());
}

function extractInputValue(event: CareEventRecord): string {
  if (event.kind === "FEEDING") {
    return String(
      event.payload.durationMinutes ?? event.payload.volumeMl ?? "",
    );
  }

  if (event.kind === "TEMPERATURE") {
    return String(event.payload.temperatureC ?? "");
  }

  if (event.kind === "SOLID_FOOD") {
    return String(event.payload.food ?? event.payload.note ?? "");
  }

  if (event.kind === "MEDICATION") {
    const medication = String(event.payload.medication ?? "").trim();
    const dose = String(event.payload.dose ?? "").trim();
    return [medication, dose && dose !== "без дозы" ? dose : ""]
      .filter(Boolean)
      .join(" — ");
  }

  if (event.kind === "GROWTH") {
    return String(event.payload.note ?? "");
  }

  if (event.kind === "WALK" || event.kind === "BATH") {
    const minutes = Number(event.payload.durationMinutes ?? 0);
    return minutes > 0 ? String(minutes) : "";
  }

  if (event.kind === "NOTE") {
    return String(event.payload.note ?? "");
  }

  return "";
}

function toneFromEvent(event: CareEventRecord): "default" | "warn" | "danger" {
  if (
    event.kind === "TEMPERATURE" &&
    Number(event.payload.temperatureC ?? 0) >= 37.5
  ) {
    return "danger";
  }

  if (event.kind === "MEDICATION") {
    return "warn";
  }

  return "default";
}

function accentFromEvent(kind: CareEventKind): string {
  switch (kind) {
    case "FEEDING":
      return "#67e8f9";
    case "SOLID_FOOD":
      return "#22c55e";
    case "SLEEP":
      return "#8b5cf6";
    case "DIAPER":
      return "#f59e0b";
    case "TEMPERATURE":
      return "#fb7185";
    case "MEDICATION":
      return "#f97316";
    case "GROWTH":
      return "#38bdf8";
    case "WALK":
      return "#34d399";
    case "BATH":
      return "#60a5fa";
    case "NOTE":
    default:
      return "#a3e635";
  }
}

function minutesSince(iso?: string) {
  if (!iso) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000),
  );
}

/**
 * Возвращает миллисекунды начала текущего «дня» в часовом поясе Москвы (UTC+3).
 * Используется как якорь для всей дневной/недельной/месячной статистики:
 * день переключается ровно в 00:00 МСК, независимо от часового пояса устройства.
 *
 * dayOffset = 0 → начало сегодня по МСК
 * dayOffset = -1 → начало вчера по МСК
 */
function moscowDayStart(now = new Date(), dayOffset = 0): number {
  const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3, без DST с 2014
  // Сдвигаем «сейчас» в московскую шкалу, обнуляем время, возвращаем обратно в UTC.
  const moscowNow = now.getTime() + MOSCOW_OFFSET_MS;
  const moscowDayStartUTC =
    Math.floor(moscowNow / 86_400_000) * 86_400_000 - MOSCOW_OFFSET_MS;
  return moscowDayStartUTC + dayOffset * 86_400_000;
}

/**
 * Сколько подгузников было сменено в окне последних N календарных дней по МСК.
 * Окно [startOfDay(today - days + 1), now]. Считаем только реальные смены.
 */
function diaperChangesInDays(
  events: CareEventRecord[],
  days: number,
): number {
  const start = moscowDayStart(new Date(), -(days - 1));
  return events.filter(
    (event) =>
      event.kind === "DIAPER" &&
      event.payload.changed !== false &&
      new Date(event.occurredAt).getTime() >= start,
  ).length;
}

/** Подгузники: разбивка по типу + сухой контроль за период. */
function diaperStatsInDays(events: CareEventRecord[], days: number) {
  const inWindow = eventsInDays(events, days).filter(
    (event) => event.kind === "DIAPER",
  );
  const changed = inWindow.filter((event) => event.payload.changed !== false);
  const wet = changed.filter((event) => event.payload.type === "WET").length;
  const dirty = changed.filter((event) => event.payload.type === "DIRTY").length;
  const mixed = changed.filter((event) => event.payload.type === "MIXED").length;
  const checked = inWindow.length - changed.length;
  return { changed: changed.length, wet, dirty, mixed, checked };
}

/** Базовая фильтрация событий по окну Москвы [сегодня - days + 1, сейчас]. */
function eventsInDays(
  events: CareEventRecord[],
  days: number,
): CareEventRecord[] {
  const start = moscowDayStart(new Date(), -(days - 1));
  return events.filter(
    (event) => new Date(event.occurredAt).getTime() >= start,
  );
}

/** Кормления: количество, мл (раздельно смесь/сцеженное), минуты груди. */
function feedingStatsInDays(events: CareEventRecord[], days: number) {
  const inWindow = eventsInDays(events, days).filter(
    (event) => event.kind === "FEEDING",
  );
  // Минуты груди — суммируем durationMinutes по mode === "BREAST"
  const breastEvents = inWindow.filter(
    (event) => event.payload.mode === "BREAST",
  );
  const breastMinutes = breastEvents.reduce((sum, event) => {
    const m = Number(event.payload.durationMinutes ?? 0);
    return sum + (Number.isFinite(m) && m > 0 ? m : 0);
  }, 0);
  // Бутылочка-смесь и сцеженное молоко считаются раздельно
  const formulaMl = inWindow
    .filter((event) => event.payload.mode === "BOTTLE")
    .reduce((sum, event) => {
      const v = Number(event.payload.volumeMl ?? 0);
      return sum + (Number.isFinite(v) && v > 0 ? v : 0);
    }, 0);
  const breastMilkMl = inWindow
    .filter((event) => event.payload.mode === "BREAST_BOTTLE")
    .reduce((sum, event) => {
      const v = Number(event.payload.volumeMl ?? 0);
      return sum + (Number.isFinite(v) && v > 0 ? v : 0);
    }, 0);
  const bottleCount = inWindow.filter(
    (event) =>
      event.payload.mode === "BOTTLE" || event.payload.mode === "BREAST_BOTTLE",
  ).length;
  return {
    count: inWindow.length,
    breastCount: breastEvents.length,
    breastMinutes: Math.round(breastMinutes),
    bottleCount,
    formulaMl: Math.round(formulaMl),
    breastMilkMl: Math.round(breastMilkMl),
    totalMl: Math.round(formulaMl + breastMilkMl),
  };
}

/** Сон: количество отрезков и общая длительность в минутах (только пары START→END). */
function sleepStatsInDays(events: CareEventRecord[], days: number) {
  const inWindow = eventsInDays(events, days).filter(
    (event) => event.kind === "SLEEP",
  );
  const starts = inWindow
    .filter((event) => event.payload.phase === "START")
    .sort(
      (l, r) =>
        new Date(l.occurredAt).getTime() - new Date(r.occurredAt).getTime(),
    );
  const ends = inWindow
    .filter((event) => event.payload.phase === "END")
    .sort(
      (l, r) =>
        new Date(l.occurredAt).getTime() - new Date(r.occurredAt).getTime(),
    );
  let totalMinutes = 0;
  let completed = 0;
  starts.forEach((startEvent, index) => {
    const endEvent = ends[index];
    const endTime = endEvent
      ? new Date(endEvent.occurredAt).getTime()
      : Date.now();
    if (endEvent) completed += 1;
    totalMinutes += Math.max(
      0,
      Math.round(
        (endTime - new Date(startEvent.occurredAt).getTime()) / 60000,
      ),
    );
  });
  return { sessions: completed, totalMinutes };
}

/** Прогулка: количество завершённых выходов и общая длительность в минутах. */
function walkStatsInDays(events: CareEventRecord[], days: number) {
  const inWindow = eventsInDays(events, days).filter(
    (event) => event.kind === "WALK",
  );
  const starts = inWindow.filter((event) => event.payload.phase === "START");
  const ends = inWindow.filter((event) => event.payload.phase === "END");
  let totalMinutes = 0;
  // Парные сессии START→END
  const pairCount = Math.min(starts.length, ends.length);
  starts.slice(0, pairCount).forEach((s, idx) => {
    const e = ends[idx];
    if (!e) return;
    totalMinutes += Math.max(
      0,
      Math.round(
        (new Date(e.occurredAt).getTime() -
          new Date(s.occurredAt).getTime()) /
          60000,
      ),
    );
  });
  // Ручной ввод (END с явной durationMinutes без пары)
  const manualEnds = ends
    .slice(pairCount)
    .filter((event) => Number(event.payload.durationMinutes ?? 0) > 0);
  manualEnds.forEach((event) => {
    totalMinutes += Math.max(0, Number(event.payload.durationMinutes ?? 0));
  });
  return { sessions: pairCount + manualEnds.length, totalMinutes };
}

/** Купание: количество и общая длительность в минутах. */
function bathStatsInDays(events: CareEventRecord[], days: number) {
  const inWindow = eventsInDays(events, days).filter(
    (event) => event.kind === "BATH",
  );
  const totalMinutes = inWindow.reduce(
    (sum, event) =>
      sum + Math.max(0, Number(event.payload.durationMinutes ?? 0)),
    0,
  );
  return { sessions: inWindow.length, totalMinutes };
}

function latestEvent(
  events: CareEventRecord[],
  kind: CareEventKind,
  predicate: (event: CareEventRecord) => boolean = () => true,
) {
  return events.find((event) => event.kind === kind && predicate(event));
}

function buildNextCareStep(
  snapshot: NonNullable<ReturnType<typeof useCareDashboard>["snapshot"]>,
) {
  const lastFeed = latestEvent(snapshot.events, "FEEDING");
  const lastDiaper = latestEvent(snapshot.events, "DIAPER");
  const lastTemperature = latestEvent(snapshot.events, "TEMPERATURE");
  const sleeping = Boolean(snapshot.timers.sleepStartedAt);
  const feedMinutes = minutesSince(lastFeed?.occurredAt);
  const diaperMinutes = minutesSince(lastDiaper?.occurredAt);
  const temperatureValue = Number(lastTemperature?.payload.temperatureC ?? 0);

  if (snapshot.events.length === 0) {
    return {
      title: "Начните с первой записи",
      body: "Одно нажатие создаст общий журнал для мамы и папы.",
      action: "Добавить событие",
      actionId: "log" as const,
      tone: "default",
    };
  }

  if (sleeping) {
    return {
      title: "Сон идёт",
      body: "Когда Амир проснётся, завершите сон, чтобы сводка считалась точно.",
      action: "Завершить сон",
      actionId: "sleep" as ActionId,
      tone: "calm",
    };
  }

  if (temperatureValue >= 37.5) {
    return {
      title: "Температура под контролем",
      body: "Полезно повторить замер и держать лекарства в быстром доступе.",
      action: "Замерить",
      actionId: "temperature" as ActionId,
      tone: "danger",
    };
  }

  if (feedMinutes >= 180) {
    return {
      title: "Пора проверить кормление",
      body: `Последняя запись: ${lastFeed?.summary ?? "пока нет"} — ${snapshot.overview.lastFeeding}.`,
      action: "Кормление",
      actionId: "feeding" as ActionId,
      tone: "warm",
    };
  }

  if (diaperMinutes >= 120) {
    return {
      title: "Проверьте подгузник",
      body: `С последней смены прошло: ${snapshot.overview.diaperGap}.`,
      action: "Подгузник",
      actionId: "diaper" as ActionId,
      tone: "warm",
    };
  }

  return {
    title: "Режим выглядит спокойно",
    body: "Ключевые интервалы в норме. Следите за сном, кормлением и подгузником.",
    action: "Открыть ленту",
    actionId: "feed" as const,
    tone: "default",
  };
}

export function CareDashboard() {
  const {
    snapshot,
    activeActor,
    actorLocked,
    actorDisplayName,
    loading,
    syncing,
    pendingCount,
    conflictCount,
    online,
    lastSyncedAt,
    accessDenied,
    aiAnswer,
    error,
    changeActor,
    addEvent,
    editEvent,
    refreshSnapshot,
    refreshAi,
    downloadExport,
    deleteQuickItem,
    removeEvent,
  } = useCareDashboard();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [sheetActionId, setSheetActionId] = useState<ActionId | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [inputValue, setInputValue] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [timeValue, setTimeValue] = useState(moscowNowTimeString());
  const [entryDateValue, setEntryDateValue] = useState(() =>
    toDateInputValue(new Date()),
  );
  const [sheetActor, setSheetActor] = useState<ActorId>("mom");
  const [editingEvent, setEditingEvent] = useState<CareEventRecord | null>(
    null,
  );
  const [summaryPeriodId, setSummaryPeriodId] = useState<SummaryPeriodId>("1d");
  const [summaryDateValue, setSummaryDateValue] = useState(() =>
    toDateInputValue(new Date()),
  );
  const [feedKindFilter, setFeedKindFilter] = useState<FeedKindFilter>("ALL");
  const [feedActorFilter, setFeedActorFilter] = useState<ActorFilter>("ALL");
  const [exportPeriodId, setExportPeriodId] = useState<SummaryPeriodId>("30d");
  const [exportKindFilter, setExportKindFilter] =
    useState<FeedKindFilter>("ALL");
  const [exportActorFilter, setExportActorFilter] =
    useState<ActorFilter>("ALL");
  const [exportingFormat, setExportingFormat] = useState<"pdf" | "csv" | null>(
    null,
  );
  const [exportError, setExportError] = useState("");
  const [deletingQuickItemKey, setDeletingQuickItemKey] = useState<
    string | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeleteEvent, setPendingDeleteEvent] =
    useState<CareEventRecord | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  /**
   * Тоггл «Сменили подгузник» — относится только к экрану ввода подгузника.
   * По умолчанию true (что соответствует превалирующему сценарию: смена).
   * Если выключен — событие сохраняется как сухой контроль (changed=false, type=DRY_CHECK).
   */
  const [diaperChanged, setDiaperChanged] = useState(true);
  const sheetPanelRef = useRef<HTMLDivElement>(null);
  const mainInputRef = useRef<HTMLInputElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const currentAction = actionById(sheetActionId);
  const currentPresets = currentAction
    ? getActionPresets(currentAction, sheetActor, snapshot?.quickItems ?? [])
    : [];
  const currentPreset =
    currentPresets.find((preset) => preset.id === selectedPresetId) ??
    currentPresets[0];
  const canChangeActor = !actorLocked;
  const submitValidationMessage = getSubmitValidationMessage(
    currentAction,
    currentPreset,
    inputValue,
    fieldValues,
  );
  const submitDisabled = submitting || Boolean(submitValidationMessage);

  const openCreateSheet = (actionId: ActionId) => {
    const action = actionById(actionId);
    const preset = action
      ? getActionPresets(action, activeActor, snapshot?.quickItems ?? [])[0]
      : undefined;
    setSheetActionId(actionId);
    setSelectedPresetId(preset?.id ?? "");
    setInputValue(preset?.defaultInput ?? "");
    setFieldValues(getDefaultFieldValues(preset));
    setEntryDateValue(toDateInputValue(new Date()));
    setTimeValue(moscowNowTimeString());
    setSheetActor(activeActor);
    setEditingEvent(null);
    setDiaperChanged(true);
  };

  const openEditSheet = (event: CareEventRecord) => {
    const actionId = resolveActionId(event.kind);
    const action = actionById(actionId);
    const presetId = resolvePresetId(event);
    const presets = action
      ? getActionPresets(action, event.actor, snapshot?.quickItems ?? [])
      : [];
    const preset =
      presets.find((candidate) => candidate.id === presetId) ?? presets[0];

    setSheetActionId(actionId);
    setSelectedPresetId(preset?.id ?? presetId);
    setInputValue(extractInputValue(event) || preset?.defaultInput || "");
    setFieldValues({
      ...getDefaultFieldValues(preset),
      ...getEventFieldValues(event),
    });
    setEntryDateValue(toDateInputValue(new Date(event.occurredAt)));
    setTimeValue(toTimeInput(event.occurredAt));
    setSheetActor(event.actor);
    setEditingEvent(event);
    if (event.kind === "DIAPER") {
      // События с DRY_CHECK или явно сохранённым changed=false означают «не меняли»
      setDiaperChanged(
        event.payload.changed === false ||
          event.payload.type === "DRY_CHECK"
          ? false
          : true,
      );
    } else {
      setDiaperChanged(true);
    }
  };

  const closeSheet = () => {
    setSheetActionId(null);
    setSelectedPresetId("");
    setInputValue("");
    setFieldValues({});
    setEditingEvent(null);
    setDiaperChanged(true);
  };

  useEffect(() => {
    if (!currentAction) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      sheetPanelRef.current?.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSheet();
        return;
      }

      if (event.key !== "Tab" || !sheetPanelRef.current) {
        return;
      }

      const focusable = Array.from(
        sheetPanelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [currentAction]);

  /**
   * Авто-перерисовка дашборда ровно в 00:00 МСК.
   * Считает миллисекунды до следующей московской полуночи и
   * форсит refresh снимка, чтобы статистика сменилась без ручного действия.
   */
  useEffect(() => {
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext = () => {
      const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
      const moscowNow = Date.now() + MOSCOW_OFFSET_MS;
      const nextMoscowMidnightUtc =
        (Math.floor(moscowNow / 86_400_000) + 1) * 86_400_000 -
        MOSCOW_OFFSET_MS;
      // +500ms запас, чтобы пройти границу гарантированно
      const delay = Math.max(1000, nextMoscowMidnightUtc - Date.now() + 500);
      timerId = setTimeout(() => {
        if (cancelled) return;
        void refreshSnapshot(false).catch(() => {});
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, []);

  const handleSubmit = async () => {
    if (!currentAction || !currentPreset) {
      return;
    }

    if (submitValidationMessage) {
      return;
    }

    setSubmitting(true);
    try {
      const draft = currentPreset.buildDraft({
        actor: editingEvent ? editingEvent.actor : sheetActor,
        occurredAt: combineDateAndTime(entryDateValue, timeValue),
        inputValue,
        fieldValues,
      });

      // Применяем тоггл "Сменили подгузник" только для DIAPER:
      // если меняли — оставляем как есть (changed=true, исходный type),
      // если не меняли — сохраняем что увидели + меняем глагол в summary,
      // type остаётся реальным (WET/DIRTY/MIXED), чтобы не терять статистику.
      const finalDraft =
        currentAction.id === "diaper"
          ? {
              ...draft,
              summary: diaperChanged
                ? draft.summary
                : `Проверили подгузник — ${currentPreset.label.toLowerCase()}`,
              payload: {
                ...draft.payload,
                changed: diaperChanged,
              },
            }
          : draft;

      if (editingEvent) {
        const updatedEvent: CareEventRecord = {
          ...editingEvent,
          actor: finalDraft.actor,
          occurredAt: finalDraft.occurredAt,
          summary: finalDraft.summary,
          payload: finalDraft.payload,
          status: (finalDraft.status ?? editingEvent.status) as EventStatus,
        };
        await editEvent(updatedEvent);
      } else {
        await addEvent(finalDraft);
      }
      closeSheet();
    } catch {
      // Ошибка уже показана верхним баннером; форму оставляем открытой.
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuickItem = async (preset: ActionPreset) => {
    if (!preset.quickItem) {
      return;
    }

    setDeletingQuickItemKey(preset.quickItem.key);
    try {
      await deleteQuickItem(
        preset.quickItem.kind,
        preset.quickItem.label,
        preset.quickItem.key,
      );
      if (selectedPresetId === preset.id) {
        setSelectedPresetId("");
      }
    } catch {
      // Верхний баннер покажет ошибку; список не трогаем.
    } finally {
      setDeletingQuickItemKey(null);
    }
  };

  const handleExportDownload = async (format: "pdf" | "csv") => {
    setExportingFormat(format);
    setExportError("");
    try {
      await downloadExport(format, exportFilters);
    } catch (error) {
      setExportError(
        error instanceof Error
          ? error.message
          : "Не удалось скачать файл экспорта.",
      );
    } finally {
      setExportingFormat(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteEvent) {
      return;
    }
    setDeletingEventId(pendingDeleteEvent.id);
    try {
      await removeEvent(pendingDeleteEvent);
      setPendingDeleteEvent(null);
    } catch {
      // ошибка уже отрендерена баннером, диалог оставляем чтобы пользователь повторил
    } finally {
      setDeletingEventId(null);
    }
  };

  if (accessDenied) {
    return (
      <div className="page-shell">
        <Card className="app-loading-card access-card">
          <div className="empty-icon" aria-hidden="true">
            !
          </div>
          <div className="loading-copy">Доступ закрыт</div>
          <div className="loading-hint">
            {error || "Mini App доступен только маме @manizha_u и папе @yamob."}
          </div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-shell">
        <Card className="app-loading-card">
          <div className="loading-spinner" aria-hidden="true" />
          <div className="loading-copy">
            Собираю семейную ленту и свежие показатели…
          </div>
          <div className="loading-hint">
            Если Telegram Desktop держит окно открытым, ответ сервера ограничен
            таймаутом.
          </div>
        </Card>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="page-shell">
        <Card className="app-loading-card">
          <div className="empty-icon" aria-hidden="true">
            !
          </div>
          <div className="loading-copy">Не удалось открыть данные семьи</div>
          <div className="loading-hint">
            {error ||
              "Проверьте интернет в Telegram и повторите загрузку. Локальные записи не удаляются."}
          </div>
          <div className="retry-row">
            <PrimaryButton onClick={() => void refreshSnapshot()}>
              Повторить
            </PrimaryButton>
          </div>
        </Card>
      </div>
    );
  }

  const activeSummaryTemplate =
    snapshot.periodSummaries.find(
      (summary) => summary.id === summaryPeriodId,
    ) ??
    snapshot.periodSummaries[0] ??
    ({
      ...snapshot.summary,
      id: "1d",
      title: "1 день",
      days: 1,
    } as const);
  const activeSummary = buildSummaryForDate(
    snapshot.events,
    activeSummaryTemplate,
    summaryDateValue,
  );
  const growthReadings = getGrowthReadings(snapshot.events);

  const summaryMetrics = [
    {
      label: "Кормлений",
      value: String(activeSummary.feedingsCount),
      helper: `грудь ${activeSummary.feedingsBreastCount ?? 0} • бутылочка ${activeSummary.feedingsBottleCount ?? 0}`,
    },
    {
      label: "Молоко всего",
      value: `${activeSummary.feedingsTotalMl ?? 0} мл`,
      helper:
        (activeSummary.feedingsBreastMilkBottleCount ?? 0) > 0
          ? `сцеженное молоко ${activeSummary.feedingsBreastMilkBottleCount}`
          : "смесь и сцеженное молоко",
    },
    {
      label: "Прикорм",
      value: String(activeSummary.solidFoodsCount ?? 0),
      helper: "продукты и реакции",
    },
    {
      label: "Общий сон",
      value: formatDuration(activeSummary.totalSleepMinutes),
      helper: "по отмеченным отрезкам",
    },
    {
      label: "Средний интервал",
      value: formatDuration(activeSummary.averageFeedingIntervalMinutes),
      helper: "между кормлениями",
    },
    {
      label: "Сменили подгузник",
      value: String(
        activeSummary.diaperChangedCount ??
          activeSummary.diaperWetCount +
            activeSummary.diaperDirtyCount +
            (activeSummary.diaperMixedCount ?? 0),
      ),
      helper: `моча ${activeSummary.diaperWetCount} • кака ${activeSummary.diaperDirtyCount} • вместе ${activeSummary.diaperMixedCount ?? 0}${
        (activeSummary.diaperCheckedOnlyCount ?? 0) > 0
          ? ` • сухой контроль ${activeSummary.diaperCheckedOnlyCount}`
          : ""
      }`,
    },
    {
      label: "Прогулка",
      value: formatDuration(activeSummary.totalWalkMinutes ?? 0),
      helper:
        (activeSummary.walkSessionsCount ?? 0) > 0
          ? `${activeSummary.walkSessionsCount} ${
              (activeSummary.walkSessionsCount ?? 0) === 1 ? "выход" : "выхода"
            }`
          : "за период не было",
    },
    {
      label: "Купание",
      value: formatDuration(activeSummary.totalBathMinutes ?? 0),
      helper:
        (activeSummary.bathSessionsCount ?? 0) > 0
          ? `${activeSummary.bathSessionsCount} ${
              (activeSummary.bathSessionsCount ?? 0) === 1 ? "раз" : "раза"
            }`
          : "за период не было",
    },
    {
      label: "Температура",
      value: String(activeSummary.temperatureReadingsCount),
      helper: "замеры за период",
    },
    {
      label: "Лекарства",
      value: String(activeSummary.medicationsCount),
      helper: "отмеченные приёмы",
    },
    {
      label: "Вес и рост",
      value: String(activeSummary.growthReadingsCount ?? 0),
      helper: "контрольные измерения",
    },
  ];

  const filteredFeedEvents = snapshot.events.filter((event) => {
    const matchesKind =
      feedKindFilter === "ALL" || event.kind === feedKindFilter;
    const matchesActor =
      feedActorFilter === "ALL" || event.actor === feedActorFilter;
    return matchesKind && matchesActor;
  });
  const feedGroups = filteredFeedEvents.reduce<
    Array<{ key: string; title: string; events: CareEventRecord[] }>
  >((groups, event) => {
    const key = dayKey(event.occurredAt);
    const current = groups.find((group) => group.key === key);
    if (current) {
      current.events.push(event);
      return groups;
    }

    groups.push({
      key,
      title: dayTitle(event.occurredAt),
      events: [event],
    });
    return groups;
  }, []);
  const exportFilters = {
    period: exportPeriodId,
    kind: exportKindFilter === "ALL" ? "all" : exportKindFilter,
    actor: exportActorFilter === "ALL" ? "all" : exportActorFilter,
  };
  const exportPeriodLabel =
    snapshot.periodSummaries.find((summary) => summary.id === exportPeriodId)
      ?.title ?? "период";
  const exportKindLabel =
    kindFilterOptions.find((option) => option.id === exportKindFilter)?.label ??
    "Все";
  const exportActorLabel =
    actorFilterOptions.find((option) => option.id === exportActorFilter)
      ?.label ?? "Оба";
  const nextCareStep = buildNextCareStep(snapshot);
  const todaySummary = snapshot.summary;
  const totalDiaperEvents =
    (todaySummary.diaperWetCount ?? 0) +
    (todaySummary.diaperDirtyCount ?? 0) +
    (todaySummary.diaperMixedCount ?? 0);
  const diaperChangedCount = todaySummary.diaperChangedCount ?? totalDiaperEvents;
  const diaperCheckedOnlyCount = todaySummary.diaperCheckedOnlyCount ?? 0;
  const totalFeedingMl = todaySummary.feedingsTotalMl ?? 0;
  const breastFeedingsCount = todaySummary.feedingsBreastCount ?? 0;
  const bottleFeedingsCount = todaySummary.feedingsBottleCount ?? 0;
  const breastMilkBottleCount = todaySummary.feedingsBreastMilkBottleCount ?? 0;
  const totalWalkMinutes = todaySummary.totalWalkMinutes ?? 0;
  const walkSessionsCount = todaySummary.walkSessionsCount ?? 0;
  const totalBathMinutes = todaySummary.totalBathMinutes ?? 0;
  const bathSessionsCount = todaySummary.bathSessionsCount ?? 0;

  // Расход подгузников за день / неделю / месяц + средний в день за неделю.
  // Считаем только фактические смены (без «только проверили»).
  const diapersToday = diaperChangesInDays(snapshot.events, 1);
  const diapersWeek = diaperChangesInDays(snapshot.events, 7);
  const diapersMonth = diaperChangesInDays(snapshot.events, 30);
  const diaperAvgPerDay =
    diapersWeek > 0 ? Math.round((diapersWeek / 7) * 10) / 10 : 0;

  // Подробная разбивка подгузников по типам/проверкам
  const diaperDay = diaperStatsInDays(snapshot.events, 1);
  const diaperWeekStats = diaperStatsInDays(snapshot.events, 7);
  const diaperMonthStats = diaperStatsInDays(snapshot.events, 30);

  // Период-статы для всех остальных категорий
  const feedingsDay = feedingStatsInDays(snapshot.events, 1);
  const feedingsWeek = feedingStatsInDays(snapshot.events, 7);
  const feedingsMonth = feedingStatsInDays(snapshot.events, 30);
  const sleepDay = sleepStatsInDays(snapshot.events, 1);
  const sleepWeek = sleepStatsInDays(snapshot.events, 7);
  const sleepMonth = sleepStatsInDays(snapshot.events, 30);
  const walkDay = walkStatsInDays(snapshot.events, 1);
  const walkWeek = walkStatsInDays(snapshot.events, 7);
  const walkMonth = walkStatsInDays(snapshot.events, 30);
  const bathDay = bathStatsInDays(snapshot.events, 1);
  const bathWeek = bathStatsInDays(snapshot.events, 7);
  const bathMonth = bathStatsInDays(snapshot.events, 30);
  const syncLabel =
    conflictCount > 0
      ? `${conflictCount} запись требует проверки`
      : !online
        ? "Оффлайн"
        : pendingCount > 0
          ? `${pendingCount} ждёт синхронизации`
          : syncing
            ? "Синхронизация"
            : lastSyncedAt
              ? `Актуально в ${formatTime(lastSyncedAt)}`
              : "Актуально";
  // ---- Home: live status helpers ---------------------------------------
  const lastFeedEvent = snapshot.events.find(
    (event) => event.kind === "FEEDING",
  );
  const lastDiaperEvent = snapshot.events.find(
    (event) => event.kind === "DIAPER" && event.payload.changed !== false,
  );
  const lastTempEvent = snapshot.events.find(
    (event) => event.kind === "TEMPERATURE",
  );
  const sleepingNow = Boolean(snapshot.timers.sleepStartedAt);
  const sleepDurationMinutes = snapshot.timers.sleepDurationMinutes ?? 0;
  const minutesSinceLastFeed = lastFeedEvent
    ? minutesSince(lastFeedEvent.occurredAt)
    : null;
  const minutesSinceLastDiaper = lastDiaperEvent
    ? minutesSince(lastDiaperEvent.occurredAt)
    : null;
  const lastTempC = lastTempEvent
    ? Number(lastTempEvent.payload.temperatureC ?? 0)
    : null;

  const liveStatus = (() => {
    if (snapshot.events.length === 0) {
      return {
        kicker: "Готовы начать",
        title: `Привет, ${snapshot.child.name}`,
        body: "Сделайте первую запись — мама и папа увидят её мгновенно.",
        tone: "default" as const,
      };
    }
    if (sleepingNow) {
      return {
        kicker: "Сейчас",
        title: "Спит",
        body:
          sleepDurationMinutes > 0
            ? `${formatDuration(sleepDurationMinutes)} с ${formatTime(snapshot.timers.sleepStartedAt)}`
            : `с ${formatTime(snapshot.timers.sleepStartedAt)}`,
        tone: "calm" as const,
      };
    }
    if (lastTempC !== null && lastTempC >= 37.5) {
      return {
        kicker: "Внимание",
        title: `Температура ${lastTempC.toFixed(1)}°C`,
        body: "Полезно повторить замер и держать лекарства под рукой.",
        tone: "danger" as const,
      };
    }
    if (minutesSinceLastFeed !== null && minutesSinceLastFeed >= 180) {
      return {
        kicker: "Пора",
        title: "Кормление",
        body: `Прошло ${formatDuration(minutesSinceLastFeed)} с последней записи.`,
        tone: "warm" as const,
      };
    }
    if (minutesSinceLastDiaper !== null && minutesSinceLastDiaper >= 120) {
      return {
        kicker: "Проверьте",
        title: "Подгузник",
        body: `${formatDuration(minutesSinceLastDiaper)} со смены.`,
        tone: "warm" as const,
      };
    }
    return {
      kicker: "Сейчас",
      title: "Бодрствует",
      body:
        minutesSinceLastFeed !== null
          ? `Кормили ${formatDuration(minutesSinceLastFeed)} назад. Режим спокойный.`
          : "Режим спокойный.",
      tone: "default" as const,
    };
  })();

  /** Чипы today digest. Кликабельные — переводят на нужный фильтр в ленте. */
  const todayChips = [
    {
      key: "milk",
      icon: "🍼",
      label: "Молоко",
      value: `${totalFeedingMl} мл`,
      hint:
        breastMilkBottleCount > 0 && bottleFeedingsCount > breastMilkBottleCount
          ? `смесь ${bottleFeedingsCount - breastMilkBottleCount} · сцеж. ${breastMilkBottleCount}`
          : breastMilkBottleCount > 0
            ? `сцеж. ${breastMilkBottleCount}`
            : null,
      filter: "FEEDING" as FeedKindFilter,
    },
    {
      key: "feedings",
      icon: "🤱",
      label: "Кормлений",
      value: String(todaySummary.feedingsCount),
      hint:
        breastFeedingsCount > 0 || bottleFeedingsCount > 0
          ? `грудь ${breastFeedingsCount} · бут. ${bottleFeedingsCount}`
          : null,
      filter: "FEEDING" as FeedKindFilter,
    },
    {
      key: "diaper",
      icon: "🧷",
      label: "Сменили",
      value: String(diaperChangedCount),
      hint:
        diaperCheckedOnlyCount > 0
          ? `+ проверили ${diaperCheckedOnlyCount}`
          : null,
      filter: "DIAPER" as FeedKindFilter,
    },
    {
      key: "sleep",
      icon: "🌙",
      label: "Сон",
      value: formatDuration(todaySummary.totalSleepMinutes),
      hint: null,
      filter: "SLEEP" as FeedKindFilter,
    },
    {
      key: "walk",
      icon: "🌳",
      label: "Прогулка",
      value: formatDuration(totalWalkMinutes),
      hint:
        walkSessionsCount > 0
          ? `${walkSessionsCount} ${walkSessionsCount === 1 ? "выход" : "выхода"}`
          : null,
      filter: "WALK" as FeedKindFilter,
    },
    {
      key: "bath",
      icon: "🛁",
      label: "Купание",
      value: formatDuration(totalBathMinutes),
      hint:
        bathSessionsCount > 0
          ? `${bathSessionsCount} ${bathSessionsCount === 1 ? "раз" : "раза"}`
          : null,
      filter: "BATH" as FeedKindFilter,
    },
  ];

  const renderHome = () => (
    <>
      <section className="dashboard-section">
        <div className="hero-greeting" aria-label={`Привет, ${snapshot.child.name}`}>
          {/* декоративные слои */}
          <span className="hero-stars" aria-hidden="true">
            <span className="hero-star hero-star-1" />
            <span className="hero-star hero-star-2" />
            <span className="hero-star hero-star-3" />
            <span className="hero-star hero-star-4" />
            <span className="hero-star hero-star-5" />
          </span>
          <span className="hero-blob hero-blob-1" aria-hidden="true" />
          <span className="hero-blob hero-blob-2" aria-hidden="true" />
          <span className="hero-blob hero-blob-3" aria-hidden="true" />

          <div className="hero-content">
            <span className="hero-hi">Привет,</span>
            <h1 className="hero-name">{snapshot.child.name}</h1>
            <span className="hero-divider" aria-hidden="true" />
          </div>
        </div>

        <div className="home-meta-row">
          {(() => {
            const age = calculateAgeBreakdown(snapshot.child.birthDate);
            return (
              <div
                className="age-card"
                role="group"
                aria-label={`Возраст: ${age.primary} ${age.primaryUnit}, ${age.totalDays} дней`}
              >
                <div className="age-card-main">
                  <span className="age-card-primary">{age.primary}</span>
                  {age.primaryUnit ? (
                    <span className="age-card-unit">{age.primaryUnit}</span>
                  ) : null}
                </div>
                <div className="age-card-meta">
                  <span className="age-card-days">{age.totalDays} дн</span>
                  {age.milestone ? (
                    <span className="age-card-milestone">
                      <span
                        className="age-card-milestone-icon"
                        aria-hidden="true"
                      >
                        ✨
                      </span>
                      <span>
                        до {age.milestone.label}{" "}
                        <strong>
                          {age.milestone.daysLeft}{" "}
                          {age.milestone.daysLeft === 1
                            ? "день"
                            : age.milestone.daysLeft < 5
                              ? "дня"
                              : "дней"}
                        </strong>
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })()}
        </div>

        {conflictCount > 0 ? (
          <div className="sync-warning">
            На другом устройстве запись уже изменилась. Откройте ленту, проверьте
            и сохраните исправление повторно.
          </div>
        ) : null}
      </section>

      <section className="dashboard-section">
        <SectionTitle title="Кормления" />
        <div className="feeding-stats-grid">
          <FeedingPeriodCard period="День" stats={feedingsDay} tone="day" />
          <FeedingPeriodCard
            period="Неделя"
            stats={feedingsWeek}
            tone="week"
          />
          <FeedingPeriodCard
            period="Месяц"
            stats={feedingsMonth}
            tone="month"
          />
        </div>
      </section>

      <section className="dashboard-section">
        <SectionTitle title="Расход подгузников" />
        <div className="feeding-stats-grid">
          {(
            [
              {
                tone: "day" as const,
                period: "День",
                stats: diaperDay,
                total: diapersToday,
                empty: "сегодня не меняли",
              },
              {
                tone: "week" as const,
                period: "Неделя",
                stats: diaperWeekStats,
                total: diapersWeek,
                empty: "за 7 дней нет смен",
              },
              {
                tone: "month" as const,
                period: "Месяц",
                stats: diaperMonthStats,
                total: diapersMonth,
                empty: "за 30 дней нет смен",
              },
            ] as const
          ).map(({ tone, period, stats, total, empty }) => (
            <PeriodCard
              key={tone}
              category="diaper"
              tone={tone}
              period={period}
              headIcon={tone === "day" ? "🧷" : tone === "week" ? "📅" : "📆"}
              headValue={String(total)}
              headUnit="смен"
              emptyText={empty}
              rows={[
                {
                  icon: "💧",
                  label: "Пописал",
                  value: stats.wet > 0 ? String(stats.wet) : "0",
                  source: "diaper-wet",
                },
                {
                  icon: "💩",
                  label: "Покакал",
                  value: stats.dirty > 0 ? String(stats.dirty) : "0",
                  source: "diaper-dirty",
                },
                {
                  icon: "🟫",
                  label: "Оба",
                  value: stats.mixed > 0 ? String(stats.mixed) : "0",
                  source: "diaper-mixed",
                },
                ...(stats.checked > 0
                  ? [
                      {
                        icon: "👀",
                        label: "Проверили",
                        value: String(stats.checked),
                        source: "diaper-check",
                      },
                    ]
                  : []),
              ]}
            />
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <SectionTitle title="Сон" />
        <div className="feeding-stats-grid">
          {(
            [
              { tone: "day" as const, period: "День", stats: sleepDay, empty: "сегодня сна нет" },
              { tone: "week" as const, period: "Неделя", stats: sleepWeek, empty: "за 7 дней нет данных" },
              { tone: "month" as const, period: "Месяц", stats: sleepMonth, empty: "за 30 дней нет данных" },
            ] as const
          ).map(({ tone, period, stats, empty }) => {
            const avgSession =
              stats.sessions > 0
                ? Math.round(stats.totalMinutes / stats.sessions)
                : 0;
            const days = tone === "day" ? 1 : tone === "week" ? 7 : 30;
            const avgPerDay = Math.round(stats.totalMinutes / days);
            return (
              <PeriodCard
                key={tone}
                category="sleep"
                tone={tone}
                period={period}
                headIcon={tone === "day" ? "🌙" : tone === "week" ? "📅" : "📆"}
                headValue={formatDuration(stats.totalMinutes)}
                emptyText={empty}
                rows={[
                  {
                    icon: "💤",
                    label: "Отрезков",
                    value: stats.sessions > 0 ? String(stats.sessions) : "0",
                    source: "sleep-sessions",
                  },
                  ...(stats.sessions > 0
                    ? [
                        {
                          icon: "⏱",
                          label: "Средний",
                          value: formatDuration(avgSession),
                          source: "sleep-avg",
                        },
                      ]
                    : []),
                  ...(tone !== "day" && stats.totalMinutes > 0
                    ? [
                        {
                          icon: "📊",
                          label: "В день",
                          value: formatDuration(avgPerDay),
                          source: "sleep-per-day",
                        },
                      ]
                    : []),
                ]}
              />
            );
          })}
        </div>
      </section>

      <section className="dashboard-section">
        <SectionTitle title="Прогулки" />
        <div className="feeding-stats-grid">
          {(
            [
              { tone: "day" as const, period: "День", stats: walkDay, empty: "сегодня не гуляли" },
              { tone: "week" as const, period: "Неделя", stats: walkWeek, empty: "за 7 дней не гуляли" },
              { tone: "month" as const, period: "Месяц", stats: walkMonth, empty: "за 30 дней не гуляли" },
            ] as const
          ).map(({ tone, period, stats, empty }) => {
            const avgSession =
              stats.sessions > 0
                ? Math.round(stats.totalMinutes / stats.sessions)
                : 0;
            const days = tone === "day" ? 1 : tone === "week" ? 7 : 30;
            const avgPerDay = Math.round(stats.totalMinutes / days);
            return (
              <PeriodCard
                key={tone}
                category="walk"
                tone={tone}
                period={period}
                headIcon={tone === "day" ? "🌳" : tone === "week" ? "📅" : "📆"}
                headValue={formatDuration(stats.totalMinutes)}
                emptyText={empty}
                rows={[
                  {
                    icon: "🚶",
                    label: "Выходов",
                    value: stats.sessions > 0 ? String(stats.sessions) : "0",
                    source: "walk-sessions",
                  },
                  ...(stats.sessions > 0
                    ? [
                        {
                          icon: "⏱",
                          label: "Средний",
                          value: formatDuration(avgSession),
                          source: "walk-avg",
                        },
                      ]
                    : []),
                  ...(tone !== "day" && stats.totalMinutes > 0
                    ? [
                        {
                          icon: "📊",
                          label: "В день",
                          value: formatDuration(avgPerDay),
                          source: "walk-per-day",
                        },
                      ]
                    : []),
                ]}
              />
            );
          })}
        </div>
      </section>

      <section className="dashboard-section">
        <SectionTitle title="Купание" />
        <div className="feeding-stats-grid">
          {(
            [
              { tone: "day" as const, period: "День", stats: bathDay, empty: "сегодня не купались" },
              { tone: "week" as const, period: "Неделя", stats: bathWeek, empty: "за 7 дней не купались" },
              { tone: "month" as const, period: "Месяц", stats: bathMonth, empty: "за 30 дней не купались" },
            ] as const
          ).map(({ tone, period, stats, empty }) => {
            const avgSession =
              stats.sessions > 0
                ? Math.round(stats.totalMinutes / stats.sessions)
                : 0;
            return (
              <PeriodCard
                key={tone}
                category="bath"
                tone={tone}
                period={period}
                headIcon={tone === "day" ? "🛁" : tone === "week" ? "📅" : "📆"}
                headValue={formatDuration(stats.totalMinutes)}
                emptyText={empty}
                rows={[
                  {
                    icon: "🧴",
                    label: "Раз",
                    value: stats.sessions > 0 ? String(stats.sessions) : "0",
                    source: "bath-sessions",
                  },
                  ...(stats.sessions > 0
                    ? [
                        {
                          icon: "⏱",
                          label: "Средний",
                          value: formatDuration(avgSession),
                          source: "bath-avg",
                        },
                      ]
                    : []),
                ]}
              />
            );
          })}
        </div>
      </section>

      <section className="dashboard-section">
        <GrowthChart readings={growthReadings} />
      </section>
    </>
  );

  const renderLog = () => (
    <section className="dashboard-section">
      <div className="log-tile-grid">
        {orderedActions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="log-tile"
            onClick={() => openCreateSheet(action.id)}
            aria-label={`Записать: ${action.title}`}
          >
            <span className="log-tile-icon" aria-hidden="true">
              {action.icon}
            </span>
            <span className="log-tile-title">{action.title}</span>
          </button>
        ))}
      </div>
    </section>
  );

  const renderFeed = () => (
    <section className="dashboard-section">
      <Card>
        <div className="filter-panel">
          <div className="filter-row">
            {kindFilterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={
                  feedKindFilter === option.id
                    ? "filter-chip active"
                    : "filter-chip"
                }
                aria-pressed={feedKindFilter === option.id}
                onClick={() => setFeedKindFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="filter-row">
            {actorFilterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={
                  feedActorFilter === option.id
                    ? "filter-chip active"
                    : "filter-chip"
                }
                aria-pressed={feedActorFilter === option.id}
                onClick={() => setFeedActorFilter(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="feed-list">
          {feedGroups.length ? (
            feedGroups.map((group) => (
              <div className="feed-day-group" key={group.key}>
                <div className="feed-day-header">
                  <span>{group.title}</span>
                  <span>{group.events.length}</span>
                </div>
                {group.events.map((event) => (
                  <Surface key={event.id} className="feed-card">
                    <div
                      className="feed-card-icon"
                      style={{ background: accentFromEvent(event.kind) }}
                    >
                      {eventIcon(event.kind)}
                    </div>
                    <div className="feed-card-main">
                      <div className="feed-card-top">
                        <div>
                          <div className="feed-card-title">{event.summary}</div>
                          <div className="feed-card-meta">
                            {actorLabel(event.actor)} •{" "}
                            {eventKindLabel(event.kind)} •{" "}
                            {formatDateTime(event.occurredAt)}
                          </div>
                        </div>
                        <div className="feed-card-actions">
                          <GhostButton
                            style={{
                              minHeight: 34,
                              padding: "7px 10px",
                              fontSize: 12,
                            }}
                            onClick={() => openEditSheet(event)}
                          >
                            Править
                          </GhostButton>
                          <button
                            type="button"
                            className="feed-card-delete"
                            aria-label={`Удалить запись «${event.summary}»`}
                            onClick={() => setPendingDeleteEvent(event)}
                            disabled={deletingEventId === event.id}
                          >
                            {deletingEventId === event.id ? "…" : "✕"}
                          </button>
                        </div>
                      </div>
                      <div className="feed-card-badges">
                        <Pill tone={toneFromEvent(event)}>
                          {event.editedAt
                            ? "Исправлено"
                            : event.source === "local"
                              ? "Синхронизация"
                              : "Сохранено"}
                        </Pill>
                      </div>
                    </div>
                  </Surface>
                ))}
              </div>
            ))
          ) : (
            <EmptyState
              title="Событий по фильтру нет"
              description="Измените фильтр или добавьте новую запись в лог."
            />
          )}
        </div>
      </Card>
    </section>
  );

  const renderSummary = () => (
    <section className="dashboard-section dashboard-two-columns">
      <Card>
        <SectionTitle eyebrow="Период" title="Сводка по уходу" />
        <div className="period-tabs" aria-label="Период сводки">
          {snapshot.periodSummaries.map((summary) => (
            <button
              key={summary.id}
              type="button"
              className={
                summaryPeriodId === summary.id
                  ? "period-tab active"
                  : "period-tab"
              }
              aria-pressed={summaryPeriodId === summary.id}
              onClick={() => setSummaryPeriodId(summary.id)}
            >
              {summary.title}
            </button>
          ))}
        </div>
        <label className="summary-date-field">
          <span>Дата окончания периода</span>
          <input
            type="date"
            value={summaryDateValue}
            max={toDateInputValue(new Date())}
            onChange={(event) => setSummaryDateValue(event.target.value)}
          />
        </label>
        <div className="summary-date-copy">
          Сводка считается до {activeSummary.dateLabel} включительно.
        </div>
        <div className="metrics-grid">
          {summaryMetrics.map((metric) => (
            <Surface key={metric.label} style={{ minHeight: 120 }}>
              <InlineMetric
                label={metric.label}
                value={metric.value}
                helper={metric.helper}
              />
            </Surface>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle
          eyebrow="Наблюдения"
          title="Подсказки по режиму"
          action={
            <GhostButton onClick={() => void refreshAi()}>Обновить</GhostButton>
          }
        />
        <div className="stack-list">
          <Surface>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Короткий ответ</div>
            <div
              style={{
                marginTop: 8,
                color: "var(--muted-strong)",
                lineHeight: 1.6,
              }}
            >
              {aiAnswer}
            </div>
          </Surface>
          {snapshot.insights.map((insight) => (
            <Surface key={insight.id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  {insight.title}
                </div>
                <Pill tone={insight.tone}>
                  {insight.tone === "danger"
                    ? "Внимание"
                    : insight.tone === "warn"
                      ? "Следить"
                      : "Норма"}
                </Pill>
              </div>
              <div
                style={{
                  marginTop: 8,
                  color: "var(--muted-strong)",
                  lineHeight: 1.6,
                }}
              >
                {insight.body}
              </div>
            </Surface>
          ))}
        </div>
      </Card>
    </section>
  );

  const renderExport = () => (
    <section className="dashboard-section">
      <Card className="export-command-card">
        {exportError ? (
          <div className="error-banner" role="alert">
            {exportError}
          </div>
        ) : null}
        <div className="export-hero">
          <div>
            <div className="export-hero-title">Готовый PDF для приёма</div>
            <div className="export-hero-copy">
              По умолчанию: выбранный период, все важные события, понятная
              сводка и хронология.
            </div>
            <div className="export-preview-row">
              <Pill>{exportPeriodLabel}</Pill>
              <Pill>{exportKindLabel}</Pill>
              <Pill>{exportActorLabel}</Pill>
            </div>
          </div>
          <PrimaryButton
            disabled={exportingFormat !== null}
            onClick={() => void handleExportDownload("pdf")}
          >
            {exportingFormat === "pdf" ? "Готовлю PDF…" : "Скачать PDF"}
          </PrimaryButton>
        </div>
        <div className="export-filter-grid">
          <Surface>
            <div className="filter-title">Период</div>
            <div className="filter-row">
              {snapshot.periodSummaries.map((summary) => (
                <button
                  key={summary.id}
                  type="button"
                  className={
                    exportPeriodId === summary.id
                      ? "filter-chip active"
                      : "filter-chip"
                  }
                  aria-pressed={exportPeriodId === summary.id}
                  onClick={() => setExportPeriodId(summary.id)}
                >
                  {summary.title}
                </button>
              ))}
            </div>
          </Surface>
          <Surface>
            <div className="filter-title">Тип события</div>
            <div className="filter-row">
              {kindFilterOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={
                    exportKindFilter === option.id
                      ? "filter-chip active"
                      : "filter-chip"
                  }
                  aria-pressed={exportKindFilter === option.id}
                  onClick={() => setExportKindFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Surface>
          <Surface>
            <div className="filter-title">Родитель</div>
            <div className="filter-row">
              {actorFilterOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={
                    exportActorFilter === option.id
                      ? "filter-chip active"
                      : "filter-chip"
                  }
                  aria-pressed={exportActorFilter === option.id}
                  onClick={() => setExportActorFilter(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </Surface>
        </div>
        <div className="stack-list">
          <Surface>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              Нужны сырые данные?
            </div>
            <div
              style={{
                marginTop: 8,
                color: "var(--muted-strong)",
                lineHeight: 1.6,
              }}
            >
              CSV с периодами, событиями, родителем, временем и деталями для
              анализа.
            </div>
            <div style={{ marginTop: 16 }}>
              <PrimaryButton
                disabled={exportingFormat !== null}
                onClick={() => void handleExportDownload("csv")}
              >
                {exportingFormat === "csv" ? "Готовлю CSV…" : "Скачать CSV"}
              </PrimaryButton>
            </div>
          </Surface>
        </div>
      </Card>
    </section>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case "home":
        return renderHome();
      case "log":
        return renderLog();
      case "feed":
        return renderFeed();
      case "summary":
        return renderSummary();
      case "export":
        return renderExport();
      default:
        return (
          <EmptyState title="Пусто" description="Выберите раздел снизу." />
        );
    }
  };

  return (
    <div className="page-shell">
      {error ? (
        <div className="error-banner" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      {renderActiveTab()}

      <div style={{ height: 18 }} />
      <BottomTabs
        items={tabs}
        activeId={activeTab}
        onChange={(value) => setActiveTab(value as TabId)}
      />

      {currentAction && currentPreset ? (
        <div
          className="sheet-backdrop"
          role="presentation"
          onClick={closeSheet}
        >
          <div
            ref={sheetPanelRef}
            className="sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="care-entry-sheet-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-header">
              <div>
                <div className="eyebrow">
                  {editingEvent ? "Исправление" : "Новая запись"}
                </div>
                <h3 id="care-entry-sheet-title">{currentAction.title}</h3>
              </div>
              <GhostButton onClick={closeSheet}>Закрыть</GhostButton>
            </div>

            {!editingEvent ? (
              <div className="actor-toggle">
                {canChangeActor ? (
                  (["mom", "dad"] as ActorId[]).map((actor) => (
                    <button
                      key={actor}
                      type="button"
                      onClick={() => {
                        const nextPreset = currentAction
                          ? getActionPresets(
                              currentAction,
                              actor,
                              snapshot.quickItems,
                            )[0]
                          : undefined;
                        setSheetActor(actor);
                        setSelectedPresetId(nextPreset?.id ?? "");
                        setInputValue(nextPreset?.defaultInput ?? "");
                        setFieldValues(getDefaultFieldValues(nextPreset));
                      }}
                      className={
                        actor === sheetActor
                          ? "actor-chip active"
                          : "actor-chip"
                      }
                      aria-pressed={actor === sheetActor}
                    >
                      {actorLabel(actor)}
                    </button>
                  ))
                ) : (
                  <button type="button" className="actor-chip active" disabled>
                    {actorDisplayName}
                  </button>
                )}
              </div>
            ) : null}

            <div className="preset-list">
              {currentPresets.map((preset) => (
                <div key={preset.id} className="preset-row">
                  <button
                    type="button"
                    className={[
                      preset.id === selectedPresetId
                        ? "preset-card active"
                        : "preset-card",
                      preset.helper ? "" : "preset-card-compact",
                      preset.quickItem ? "with-delete" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-pressed={preset.id === selectedPresetId}
                    onClick={() => {
                      setSelectedPresetId(preset.id);
                      setInputValue(preset.defaultInput ?? "");
                      setFieldValues(getDefaultFieldValues(preset));
                    }}
                  >
                    <div className="preset-card-title">{preset.label}</div>
                    {preset.helper ? (
                      <div className="preset-card-helper">{preset.helper}</div>
                    ) : null}
                  </button>
                  {preset.quickItem ? (
                    <button
                      type="button"
                      className="quick-delete-button"
                      aria-label={`Удалить ${preset.label}`}
                      disabled={deletingQuickItemKey === preset.quickItem.key}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDeleteQuickItem(preset);
                      }}
                    >
                      {deletingQuickItemKey === preset.quickItem.key
                        ? "…"
                        : "×"}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {currentAction.id === "diaper" ? (
              <button
                type="button"
                role="switch"
                aria-checked={diaperChanged}
                className={
                  diaperChanged
                    ? "diaper-toggle active"
                    : "diaper-toggle"
                }
                onClick={() => setDiaperChanged((value) => !value)}
              >
                <span className="diaper-toggle-track" aria-hidden="true">
                  <span className="diaper-toggle-thumb" />
                </span>
                <span className="diaper-toggle-content">
                  <span className="diaper-toggle-title">
                    Сменили подгузник
                  </span>
                </span>
              </button>
            ) : null}

            <div className="field-grid entry-date-time-grid">
              <label className="field">
                <span>Дата</span>
                <input
                  type="date"
                  value={entryDateValue}
                  max={toDateInputValue(new Date())}
                  onChange={(event) => setEntryDateValue(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Время</span>
                <input
                  type="time"
                  value={timeValue}
                  onChange={(event) => setTimeValue(event.target.value)}
                />
              </label>
            </div>

            {currentPreset.inputLabel ? (
              <label className="field">
                <span>{currentPreset.inputLabel}</span>
                {(() => {
                  const stepCfg = getStepperConfig(currentAction, currentPreset);
                  if (!stepCfg) {
                    return (
                      <input
                        ref={mainInputRef}
                        type={currentPreset.inputType ?? "text"}
                        value={inputValue}
                        placeholder={currentPreset.inputPlaceholder}
                        aria-invalid={Boolean(submitValidationMessage)}
                        aria-describedby={
                          submitValidationMessage
                            ? "care-entry-validation"
                            : undefined
                        }
                        onChange={(event) =>
                          setInputValue(event.target.value)
                        }
                      />
                    );
                  }
                  const fallback = parseNumber(currentPreset.defaultInput, 0);
                  return (
                    <div className="stepper-field">
                      <button
                        type="button"
                        className="stepper-btn"
                        aria-label="Уменьшить"
                        onClick={() =>
                          setInputValue(
                            applyStepperDelta(
                              inputValue,
                              -1,
                              stepCfg,
                              fallback,
                            ),
                          )
                        }
                      >
                        −
                      </button>
                      <input
                        ref={mainInputRef}
                        type="number"
                        inputMode="decimal"
                        step={stepCfg.step}
                        min={stepCfg.min}
                        max={stepCfg.max}
                        value={inputValue}
                        placeholder={currentPreset.inputPlaceholder}
                        aria-invalid={Boolean(submitValidationMessage)}
                        aria-describedby={
                          submitValidationMessage
                            ? "care-entry-validation"
                            : undefined
                        }
                        className="stepper-input"
                        onChange={(event) =>
                          setInputValue(event.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="stepper-btn"
                        aria-label="Увеличить"
                        onClick={() =>
                          setInputValue(
                            applyStepperDelta(
                              inputValue,
                              1,
                              stepCfg,
                              fallback,
                            ),
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                  );
                })()}
              </label>
            ) : null}

            {currentPreset.fields?.length ? (
              <div className="field-grid">
                {currentPreset.fields.map((field, index) => (
                  <label className="field" key={field.id}>
                    <span>{field.label}</span>
                    <input
                      ref={index === 0 ? firstFieldRef : undefined}
                      type={field.inputType ?? "text"}
                      value={fieldValues[field.id] ?? ""}
                      placeholder={field.inputPlaceholder}
                      aria-invalid={Boolean(submitValidationMessage)}
                      aria-describedby={
                        submitValidationMessage
                          ? "care-entry-validation"
                          : undefined
                      }
                      onChange={(event) =>
                        setFieldValues((current) => ({
                          ...current,
                          [field.id]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            ) : null}

            {submitValidationMessage ? (
              <div id="care-entry-validation" className="field-hint error">
                {submitValidationMessage}
              </div>
            ) : null}

            <div className="sheet-footer">
              <PrimaryButton
                disabled={submitDisabled}
                onClick={() => void handleSubmit()}
              >
                {submitting
                  ? "Сохраняю…"
                  : editingEvent
                    ? "Сохранить исправление"
                    : "Добавить событие"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDeleteEvent ? (
        <div
          className="sheet-backdrop"
          role="presentation"
          onClick={() => {
            if (!deletingEventId) {
              setPendingDeleteEvent(null);
            }
          }}
        >
          <div
            className="confirm-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="eyebrow">Удаление</div>
            <h3 id="confirm-delete-title" className="confirm-title">
              Удалить запись?
            </h3>
            <div className="confirm-summary">{pendingDeleteEvent.summary}</div>
            <div className="confirm-meta">
              {actorLabel(pendingDeleteEvent.actor)} ·{" "}
              {eventKindLabel(pendingDeleteEvent.kind)} ·{" "}
              {formatDateTime(pendingDeleteEvent.occurredAt)}
            </div>
            <div className="confirm-actions">
              <GhostButton
                onClick={() => setPendingDeleteEvent(null)}
                disabled={Boolean(deletingEventId)}
              >
                Отмена
              </GhostButton>
              <PrimaryButton
                onClick={() => void handleConfirmDelete()}
                disabled={Boolean(deletingEventId)}
                style={{
                  background:
                    "linear-gradient(135deg, #f87171 0%, #ef4444 60%, #dc2626 100%)",
                }}
              >
                {deletingEventId ? "Удаляю…" : "Удалить"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

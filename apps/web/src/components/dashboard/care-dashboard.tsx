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
  StatTile,
  Surface,
  TimelineItem,
} from "@amir/ui";

import {
  actorLabel,
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
  | "growth";
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
  { id: "home", label: "Главная", icon: "◉" },
  { id: "log", label: "Запись", icon: "＋" },
  { id: "feed", label: "Лента", icon: "≋" },
  { id: "summary", label: "Итоги", icon: "◫" },
  { id: "export", label: "Отчёт", icon: "⇩" },
] satisfies Array<{ id: TabId; label: string; icon: string }>;

const kindFilterOptions: Array<{ id: FeedKindFilter; label: string }> = [
  { id: "ALL", label: "Все" },
  { id: "FEEDING", label: "Кормление" },
  { id: "DIAPER", label: "Подгузник" },
  { id: "SOLID_FOOD", label: "Прикорм" },
  { id: "SLEEP", label: "Сон" },
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
    subtitle: "Грудь или бутылочка",
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
          const durationMinutes = Number(inputValue || 18);
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
        id: "bottle",
        label: "Бутылочка",
        helper: "По умолчанию 120 мл",
        defaultInput: "120",
        inputLabel: "Миллилитры",
        inputType: "number",
        buildDraft: ({ actor, occurredAt, inputValue }) => {
          const volumeMl = Number(inputValue || 120);
          return {
            kind: "FEEDING",
            actor,
            occurredAt,
            summary: `Бутылочка — ${volumeMl} мл`,
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
    subtitle: "Пописал, покакал или всё вместе",
    presets: [
      {
        id: "wet",
        label: "Пописал",
        helper: "Быстрая отметка подгузника",
        buildDraft: ({ actor, occurredAt }) => ({
          kind: "DIAPER",
          actor,
          occurredAt,
          summary: "Подгузник — пописал",
          payload: { type: "WET" },
          status: "LOGGED",
        }),
      },
      {
        id: "dirty",
        label: "Покакал",
        helper: "Отдельная отметка стула",
        buildDraft: ({ actor, occurredAt }) => ({
          kind: "DIAPER",
          actor,
          occurredAt,
          summary: "Подгузник — покакал",
          payload: { type: "DIRTY" },
          status: "LOGGED",
        }),
      },
      {
        id: "mixed",
        label: "Пописал и покакал",
        helper: "Одна отметка для смешанного подгузника",
        buildDraft: ({ actor, occurredAt }) => ({
          kind: "DIAPER",
          actor,
          occurredAt,
          summary: "Подгузник — пописал и покакал",
          payload: { type: "MIXED" },
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
          const temperatureC = Number(inputValue || 36.8);
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
];

const actionOrder: ActionId[] = [
  "feeding",
  "diaper",
  "solid_food",
  "sleep",
  "medication",
  "temperature",
  "note",
  "growth",
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
    case "NOTE":
    default:
      return "Заметка";
  }
}

function eventIcon(kind: CareEventKind): string {
  return actions.find((action) => action.kind === kind)?.icon ?? "•";
}

function dayKey(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function dayTitle(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(value));
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateInputToDayEnd(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    const fallback = new Date();
    fallback.setHours(23, 59, 59, 999);
    return fallback;
  }

  return new Date(year, month - 1, day, 23, 59, 59, 999);
}

function dateInputToLabel(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dateInputToDayEnd(value));
}

function periodRangeEnd(value: string): number {
  return dateInputToDayEnd(value).getTime();
}

function periodRangeStart(days: number | null, value: string): number {
  if (days === null) {
    return Number.NEGATIVE_INFINITY;
  }

  const end = dateInputToDayEnd(value);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  start.setDate(start.getDate() - days + 1);
  return start.getTime();
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

  const summary: DailySummary = {
    dateLabel: dateInputToLabel(dateValue),
    feedingsCount: feedingEvents.length,
    solidFoodsCount: periodEvents.filter((event) => event.kind === "SOLID_FOOD")
      .length,
    totalSleepMinutes,
    averageFeedingIntervalMinutes:
      feedingEvents.length > 1
        ? Math.round(intervalSum / (feedingEvents.length - 1))
        : 0,
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
  };

  return {
    ...summary,
    id: period.id,
    title: period.title,
    days: period.days,
  };
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

function growthSeriesPoints(
  readings: GrowthReading[],
  key: GrowthMetricKey,
): Array<{ x: number; y: number; value: number; label: string }> {
  const metricValues = growthMetricValues(readings, key);
  const values = metricValues.map((item) => item.value);

  if (!values.length) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 320;
  const height = 126;
  const pad = 18;
  const range = max - min || 1;

  return metricValues.map((reading, index) => {
    const x =
      metricValues.length === 1
        ? width / 2
        : pad + (index / (metricValues.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (reading.value - min) / range) * (height - pad * 2);
    return { x, y, value: reading.value, label: reading.label };
  });
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
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");
  const tone = metricKey === "weightKg" ? "weight" : "height";
  const title = growthMetricLabel(metricKey);

  return (
    <Surface className={`growth-panel growth-panel-${tone}`}>
      <div className="growth-panel-head">
        <div>
          <div className="growth-panel-label">{title}</div>
          <div className="growth-panel-value">
            {formatGrowthValue(latest?.value ?? null, metricKey)}
          </div>
        </div>
        <Pill>{latest?.label ?? "нет"}</Pill>
      </div>
      {values.length ? (
        <>
          <div className="growth-panel-meta">
            <span>{formatGrowthDelta(delta, metricKey)}</span>
            <span>
              {formatGrowthValue(min, metricKey)} -{" "}
              {formatGrowthValue(max, metricKey)}
            </span>
          </div>
          <div className="growth-mini-chart-wrap">
            <svg
              className="growth-mini-chart"
              viewBox="0 0 320 126"
              role="img"
              aria-label={`${title}: ${formatGrowthValue(latest?.value ?? null, metricKey)}`}
            >
              <line x1="16" y1="16" x2="304" y2="16" />
              <line x1="16" y1="63" x2="304" y2="63" />
              <line x1="16" y1="110" x2="304" y2="110" />
              {points.length > 1 ? <polyline points={path} /> : null}
              {points.map((point) => (
                <circle
                  key={`${metricKey}-${point.label}-${point.x}-${point.y}`}
                  cx={point.x}
                  cy={point.y}
                  r={points.length === 1 ? "6" : "4.5"}
                />
              ))}
            </svg>
          </div>
          <div className="growth-axis-row">
            <span>{values[0]?.label}</span>
            <span>
              {values.length} {values.length === 1 ? "замер" : "замеров"}
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

function GrowthChart({ readings }: { readings: GrowthReading[] }) {
  const latestWeight = [...readings]
    .reverse()
    .find((reading) => reading.weightKg !== null);
  const latestHeight = [...readings]
    .reverse()
    .find((reading) => reading.heightCm !== null);

  return (
    <Card className="growth-card">
      <SectionTitle
        eyebrow="Развитие"
        title="Вес и рост"
        action={
          readings.length ? <Pill>{readings.at(-1)?.label}</Pill> : undefined
        }
      />
      {readings.length ? (
        <>
          <div className="growth-summary-row">
            <Surface className="growth-summary-tile">
              <span>Вес</span>
              <strong>
                {formatGrowthValue(latestWeight?.weightKg ?? null, "weightKg")}
              </strong>
            </Surface>
            <Surface className="growth-summary-tile">
              <span>Рост</span>
              <strong>
                {formatGrowthValue(latestHeight?.heightCm ?? null, "heightCm")}
              </strong>
            </Surface>
            <Surface className="growth-summary-tile">
              <span>Измерений</span>
              <strong>{readings.length}</strong>
            </Surface>
          </div>
          <div className="growth-panel-grid">
            <GrowthMetricPanel readings={readings} metricKey="weightKg" />
            <GrowthMetricPanel readings={readings} metricKey="heightCm" />
          </div>
        </>
      ) : (
        <EmptyState
          title="Измерений пока нет"
          description="После записи веса или роста здесь появится динамика."
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
    case "NOTE":
    default:
      return "note";
  }
}

function resolvePresetId(event: CareEventRecord): string {
  switch (event.kind) {
    case "FEEDING":
      return event.payload.mode === "BOTTLE" ? "bottle" : "breast";
    case "SOLID_FOOD":
      return "solid_food";
    case "SLEEP":
      return event.payload.phase === "END" ? "sleep_end" : "sleep_start";
    case "DIAPER":
      return event.payload.type === "DIRTY"
        ? "dirty"
        : event.payload.type === "MIXED"
          ? "mixed"
          : "wet";
    case "TEMPERATURE":
      return "temperature";
    case "MEDICATION":
      return "custom_medication";
    case "GROWTH":
      return "growth";
    case "NOTE":
    default:
      return "note";
  }
}

function toTimeInput(value: string): string {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function combineDateAndTime(dateValue: string, timeValue: string): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  const base = new Date();

  if (year && month && day) {
    base.setFullYear(year, month - 1, day);
  }

  base.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );

  return base.toISOString();
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
  } = useCareDashboard();
  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [sheetActionId, setSheetActionId] = useState<ActionId | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [inputValue, setInputValue] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [timeValue, setTimeValue] = useState(
    toTimeInput(new Date().toISOString()),
  );
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
    setTimeValue(toTimeInput(new Date().toISOString()));
    setSheetActor(activeActor);
    setEditingEvent(null);
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
  };

  const closeSheet = () => {
    setSheetActionId(null);
    setSelectedPresetId("");
    setInputValue("");
    setFieldValues({});
    setEditingEvent(null);
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

      if (editingEvent) {
        const updatedEvent: CareEventRecord = {
          ...editingEvent,
          actor: draft.actor,
          occurredAt: draft.occurredAt,
          summary: draft.summary,
          payload: draft.payload,
          status: (draft.status ?? editingEvent.status) as EventStatus,
        };
        await editEvent(updatedEvent);
      } else {
        await addEvent(draft);
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
      helper: activeSummary.title,
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
      label: "Подгузники",
      value: `${activeSummary.diaperWetCount + activeSummary.diaperDirtyCount + (activeSummary.diaperMixedCount ?? 0)}`,
      helper: `моча ${activeSummary.diaperWetCount} • кака ${activeSummary.diaperDirtyCount} • вместе ${activeSummary.diaperMixedCount ?? 0}`,
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
  const primaryActions = orderedActions.filter((action) =>
    ["feeding", "diaper", "sleep", "temperature"].includes(action.id),
  );
  const secondaryActions = orderedActions.filter(
    (action) => !primaryActions.includes(action),
  );
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
  const renderHome = () => (
    <>
      <section className="dashboard-section">
        <Card className="hero-card command-center-card">
          <div className="hero-topline">
            <div>
              <div className="eyebrow">Состояние ребёнка</div>
              <h1 className="hero-title">{snapshot.child.name}</h1>
            </div>
            <Pill>{snapshot.overview.age}</Pill>
          </div>

          <div className="command-metrics">
            <Surface className="command-metric">
              <InlineMetric
                label="Возраст"
                value={snapshot.overview.age}
                helper="по дате рождения"
              />
            </Surface>
            <Surface className="command-metric">
              <InlineMetric
                label="Кормление"
                value={snapshot.overview.lastFeeding}
                helper="последняя запись"
              />
            </Surface>
            <Surface className="command-metric">
              <InlineMetric
                label="Сон"
                value={snapshot.overview.sleepStatus}
                helper={
                  snapshot.timers.sleepStartedAt
                    ? `идёт с ${formatTime(snapshot.timers.sleepStartedAt)}`
                    : "сейчас бодрствует"
                }
              />
            </Surface>
            <Surface className="command-metric">
              <InlineMetric
                label="Подгузник"
                value={snapshot.overview.diaperGap}
                helper="последняя смена"
              />
            </Surface>
            <Surface className="command-metric">
              <InlineMetric
                label="Температура"
                value={snapshot.overview.temperature}
                helper="последний замер"
              />
            </Surface>
            <Surface className="command-metric">
              <InlineMetric
                label="Лекарства"
                value={snapshot.overview.medication}
                helper="последняя отметка"
              />
            </Surface>
          </div>

          <div className={`care-now-card info-only tone-${nextCareStep.tone}`}>
            <div>
              <div className="care-now-kicker">Текущее состояние</div>
              <div className="care-now-title">{nextCareStep.title}</div>
              <div className="care-now-body">{nextCareStep.body}</div>
            </div>
          </div>

          <div className="sync-panel">
            <div>
              <div
                className="sync-dot"
                data-state={
                  conflictCount > 0 ? "conflict" : online ? "online" : "offline"
                }
              />
              <span>{syncLabel}</span>
            </div>
          </div>
          {conflictCount > 0 ? (
            <div className="sync-warning">
              На другом устройстве эта запись уже изменилась. Откройте ленту,
              проверьте запись и сохраните исправление повторно.
            </div>
          ) : null}
        </Card>
      </section>

      <section className="dashboard-section">
        <GrowthChart readings={growthReadings} />
      </section>
    </>
  );

  const renderLog = () => (
    <section className="dashboard-section">
      <Card className="log-command-card">
        <SectionTitle eyebrow="Запись" title="Главные действия под рукой" />
        <div className="log-primary-grid">
          {primaryActions.map((action) => (
            <ActionButton
              key={action.id}
              icon={action.icon}
              title={action.title}
              subtitle={actionSubtitle(action, activeActor)}
              onClick={() => openCreateSheet(action.id)}
            />
          ))}
        </div>
        <div className="log-secondary-panel">
          <div>
            <div className="filter-title">Ещё записи</div>
            <div className="log-secondary-copy">
              Прикорм, лекарства, заметки и контроль роста без длинных форм.
            </div>
          </div>
          <div className="log-secondary-grid">
            {secondaryActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="log-secondary-button"
                onClick={() => openCreateSheet(action.id)}
              >
                <span>{action.icon}</span>
                <strong>{action.title}</strong>
              </button>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );

  const renderFeed = () => (
    <section className="dashboard-section">
      <Card>
        <SectionTitle eyebrow="Все действия" title="Семейная лента" />
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
        <SectionTitle eyebrow="Для врача" title="Отчёт за 10 секунд" />
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
                    <div style={{ fontSize: 16, fontWeight: 700 }}>
                      {preset.label}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        color: "var(--muted-strong)",
                        lineHeight: 1.5,
                      }}
                    >
                      {preset.helper}
                    </div>
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
                  onChange={(event) => setInputValue(event.target.value)}
                />
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
    </div>
  );
}

"use client";

import { useState } from "react";

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
  EventDraft,
  EventStatus,
  QuickItemKind,
  QuickItemRecord,
  SummaryPeriodId,
} from "@/lib/types";
import { useCareDashboard } from "@/hooks/use-care-dashboard";
import { useThemePreference } from "@/hooks/use-theme-preference";

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

const tabs = [
  { id: "home", label: "Главная", icon: "◉" },
  { id: "log", label: "Лог", icon: "＋" },
  { id: "feed", label: "Лента", icon: "≋" },
  { id: "summary", label: "Сводка", icon: "◫" },
  { id: "export", label: "Экспорт", icon: "⇩" },
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

function combineDateAndTime(baseIso: string, timeValue: string): string {
  const base = new Date(baseIso);
  const [hours, minutes] = timeValue.split(":").map(Number);
  base.setHours(hours, minutes, 0, 0);
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

export function CareDashboard() {
  const {
    snapshot,
    activeActor,
    actorLocked,
    actorDisplayName,
    loading,
    syncing,
    pendingCount,
    online,
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
  const { theme, setTheme } = useThemePreference();

  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [sheetActionId, setSheetActionId] = useState<ActionId | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [inputValue, setInputValue] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [timeValue, setTimeValue] = useState(
    toTimeInput(new Date().toISOString()),
  );
  const [sheetActor, setSheetActor] = useState<ActorId>("mom");
  const [editingEvent, setEditingEvent] = useState<CareEventRecord | null>(
    null,
  );
  const [summaryPeriodId, setSummaryPeriodId] = useState<SummaryPeriodId>("1d");
  const [feedKindFilter, setFeedKindFilter] = useState<FeedKindFilter>("ALL");
  const [feedActorFilter, setFeedActorFilter] = useState<ActorFilter>("ALL");
  const [exportPeriodId, setExportPeriodId] = useState<SummaryPeriodId>("30d");
  const [exportKindFilter, setExportKindFilter] =
    useState<FeedKindFilter>("ALL");
  const [exportActorFilter, setExportActorFilter] =
    useState<ActorFilter>("ALL");
  const [submitting, setSubmitting] = useState(false);

  const currentAction = actionById(sheetActionId);
  const currentPresets = currentAction
    ? getActionPresets(currentAction, sheetActor, snapshot?.quickItems ?? [])
    : [];
  const currentPreset =
    currentPresets.find((preset) => preset.id === selectedPresetId) ??
    currentPresets[0];
  const canChangeActor = !actorLocked;

  const openCreateSheet = (actionId: ActionId) => {
    const action = actionById(actionId);
    const preset = action
      ? getActionPresets(action, activeActor, snapshot?.quickItems ?? [])[0]
      : undefined;
    setSheetActionId(actionId);
    setSelectedPresetId(preset?.id ?? "");
    setInputValue(preset?.defaultInput ?? "");
    setFieldValues(getDefaultFieldValues(preset));
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

  const handleSubmit = async () => {
    if (!currentAction || !currentPreset) {
      return;
    }

    if (
      currentPreset.inputType === "text" &&
      currentAction.id === "note" &&
      !inputValue.trim()
    ) {
      return;
    }

    if (
      currentAction.id === "growth" &&
      !fieldValues.weightKg?.trim() &&
      !fieldValues.heightCm?.trim()
    ) {
      return;
    }

    setSubmitting(true);
    try {
      const draft = currentPreset.buildDraft({
        actor: editingEvent ? editingEvent.actor : sheetActor,
        occurredAt: combineDateAndTime(
          editingEvent?.occurredAt ?? new Date().toISOString(),
          timeValue,
        ),
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
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuickItem = async (preset: ActionPreset) => {
    if (!preset.quickItem) {
      return;
    }

    const accepted = window.confirm(
      `Удалить быструю кнопку «${preset.quickItem.label}»? История событий останется.`,
    );
    if (!accepted) {
      return;
    }

    await deleteQuickItem(
      preset.quickItem.kind,
      preset.quickItem.label,
      preset.quickItem.key,
    );
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

  const activeSummary =
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

  const latestGrowth = snapshot.events.find((event) => event.kind === "GROWTH");
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

  const renderHome = () => (
    <>
      <section className="dashboard-section">
        <Card className="hero-card">
          <div className="hero-topline">
            <div>
              <div className="eyebrow">Панель ухода</div>
              <h1 className="hero-title">{snapshot.child.name}</h1>
            </div>
            <div className="status-pills">
              <div className="theme-switch" aria-label="Тема приложения">
                <button
                  type="button"
                  className={
                    theme === "dark" ? "theme-option active" : "theme-option"
                  }
                  onClick={() => setTheme("dark")}
                >
                  Тёмная
                </button>
                <button
                  type="button"
                  className={
                    theme === "light" ? "theme-option active" : "theme-option"
                  }
                  onClick={() => setTheme("light")}
                >
                  Светлая
                </button>
              </div>
            </div>
          </div>

          <div className="role-settings-card">
            <div>
              <div className="role-settings-title">Профиль родителя</div>
              <div className="role-settings-copy">
                {canChangeActor
                  ? "Выберите один раз. Роль сохранится на этом устройстве."
                  : "Роль определена по Telegram ID и защищена от смены."}
              </div>
            </div>
            <div className="actor-toggle compact">
              {canChangeActor ? (
                (["mom", "dad"] as ActorId[]).map((actor) => (
                  <button
                    key={actor}
                    type="button"
                    onClick={() => changeActor(actor)}
                    className={
                      actor === activeActor ? "actor-chip active" : "actor-chip"
                    }
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
          </div>
          <div className="home-focus-grid">
            <Surface>
              <InlineMetric
                label="Кормление"
                value={snapshot.overview.lastFeeding}
                helper="последняя запись"
              />
            </Surface>
            <Surface>
              <InlineMetric
                label="Сон"
                value={snapshot.overview.sleepStatus}
                helper="текущий статус"
              />
            </Surface>
            <Surface>
              <InlineMetric
                label="Вес и рост"
                value={latestGrowth?.summary ?? "ещё не измеряли"}
                helper="последний контроль"
              />
            </Surface>
          </div>
        </Card>
      </section>

      <section className="dashboard-section">
        <SectionTitle eyebrow="Сейчас" title="Главные показатели" />
        <div className="stats-grid">
          <StatTile
            label="Возраст"
            value={snapshot.overview.age}
            helper="от 0 мес до 3 лет"
            accent="#67e8f9"
          />
          <StatTile
            label="Последнее кормление"
            value={snapshot.overview.lastFeeding}
            helper="по журналу ухода"
            accent="#8b5cf6"
          />
          <StatTile
            label="Сон"
            value={snapshot.overview.sleepStatus}
            helper="таймер сна активен"
            accent="#60a5fa"
          />
          <StatTile
            label="Подгузник"
            value={snapshot.overview.diaperGap}
            helper="время с последней смены"
            accent="#f59e0b"
          />
          <StatTile
            label="Температура"
            value={snapshot.overview.temperature}
            helper="статистика и тревога"
            accent="#fb7185"
          />
          <StatTile
            label="Лекарства"
            value={snapshot.overview.medication}
            helper="последний приём"
            accent="#f97316"
          />
        </div>
      </section>

      <section className="dashboard-section dashboard-two-columns">
        <Card>
          <SectionTitle
            eyebrow="Основные действия"
            title="Одно нажатие ночью"
          />
          <div className="actions-grid">
            {orderedActions.map((action) => (
              <ActionButton
                key={action.id}
                icon={action.icon}
                title={action.title}
                subtitle={actionSubtitle(action, activeActor)}
                onClick={() => openCreateSheet(action.id)}
              />
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle eyebrow="Таймеры" title="Ближайшие окна" />
          <div className="timers-grid">
            <InlineMetric
              label="Сон идёт"
              value={
                snapshot.timers.sleepDurationMinutes
                  ? formatDuration(snapshot.timers.sleepDurationMinutes)
                  : "нет"
              }
              helper={
                snapshot.timers.sleepStartedAt
                  ? `Старт в ${formatTime(snapshot.timers.sleepStartedAt)}`
                  : "ребёнок не спит"
              }
            />
            <InlineMetric
              label="Следующее кормление"
              value={
                snapshot.timers.nextFeedingAt
                  ? formatTime(snapshot.timers.nextFeedingAt)
                  : "—"
              }
              helper="подсказка для напоминаний"
            />
            <InlineMetric
              label="Проверка подгузника"
              value={
                snapshot.timers.nextDiaperCheckAt
                  ? formatTime(snapshot.timers.nextDiaperCheckAt)
                  : "—"
              }
              helper="на основе последней смены"
            />
          </div>
        </Card>
      </section>

      <section className="dashboard-section dashboard-two-columns">
        <Card>
          <SectionTitle
            eyebrow="Лента семьи"
            title="Последние действия"
            action={
              <GhostButton onClick={() => setActiveTab("feed")}>
                Вся лента
              </GhostButton>
            }
          />
          <div className="timeline-list">
            {snapshot.events.length ? (
              snapshot.events
                .slice(0, 4)
                .map((event) => (
                  <TimelineItem
                    key={event.id}
                    title={event.summary}
                    subtitle={`${actorLabel(event.actor)} • ${event.kind.toLowerCase()}`}
                    meta={formatDateTime(event.occurredAt)}
                    accent={accentFromEvent(event.kind)}
                    action={
                      <GhostButton onClick={() => openEditSheet(event)}>
                        Исправить
                      </GhostButton>
                    }
                  />
                ))
            ) : (
              <EmptyState
                title="Лента пока пустая"
                description="Здесь появятся только реальные действия мамы и папы."
              />
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle eyebrow="Напоминания" title="Кому и когда напомнить" />
          <div className="stack-list">
            {snapshot.reminders.length ? (
              snapshot.reminders.map((reminder) => (
                <Surface
                  key={reminder.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>
                      {reminder.title}
                    </div>
                    <div style={{ marginTop: 4, color: "var(--muted-strong)" }}>
                      {reminder.channel === "bot"
                        ? "Придёт в Telegram боте"
                        : "Покажется в Mini App"}
                    </div>
                  </div>
                  <Pill tone={reminder.tone}>{reminder.dueLabel}</Pill>
                </Surface>
              ))
            ) : (
              <EmptyState
                title="Напоминаний пока нет"
                description="Они появятся после первых кормлений, подгузников или лекарств."
              />
            )}
          </div>
        </Card>
      </section>
    </>
  );

  const renderLog = () => (
    <section className="dashboard-section">
      <Card>
        <SectionTitle
          eyebrow="Запись событий"
          title="Минимум ввода, максимум скорости"
        />
        <div className="actions-grid">
          {orderedActions.map((action) => (
            <ActionButton
              key={action.id}
              icon={action.icon}
              title={action.title}
              subtitle={actionSubtitle(action, activeActor)}
              onClick={() => openCreateSheet(action.id)}
            />
          ))}
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
                        <GhostButton onClick={() => openEditSheet(event)}>
                          Исправить
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
              onClick={() => setSummaryPeriodId(summary.id)}
            >
              {summary.title}
            </button>
          ))}
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
    <section className="dashboard-section dashboard-two-columns">
      <Card>
        <SectionTitle eyebrow="Для врача" title="Экспорт данных" />
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
            <div style={{ fontSize: 18, fontWeight: 700 }}>PDF</div>
            <div
              style={{
                marginTop: 8,
                color: "var(--muted-strong)",
                lineHeight: 1.6,
              }}
            >
              Аккуратная сводка по периодам, текущему статусу и событиям для
              врача.
            </div>
            <div style={{ marginTop: 16 }}>
              <PrimaryButton
                onClick={() => void downloadExport("pdf", exportFilters)}
              >
                Скачать PDF
              </PrimaryButton>
            </div>
          </Surface>
          <Surface>
            <div style={{ fontSize: 18, fontWeight: 700 }}>CSV</div>
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
                onClick={() => void downloadExport("csv", exportFilters)}
              >
                Скачать CSV
              </PrimaryButton>
            </div>
          </Surface>
        </div>
      </Card>

      <Card>
        <SectionTitle
          eyebrow="Риски и статус"
          title="Что важно помнить сейчас"
        />
        <div className="stack-list">
          <Surface>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Оффлайн-режим</div>
            <div
              style={{
                marginTop: 8,
                color: "var(--muted-strong)",
                lineHeight: 1.6,
              }}
            >
              Даже без сети новые события не теряются: они сохраняются локально
              и уйдут в синхронизацию при следующем подключении.
            </div>
          </Surface>
          <Surface>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Текущая очередь</div>
            <div
              style={{
                marginTop: 8,
                color: "var(--muted-strong)",
                lineHeight: 1.6,
              }}
            >
              В ожидании отправки: {pendingCount}. Онлайн-статус:{" "}
              {online ? "есть сеть" : "нет сети"}.
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
        <div className="error-banner">
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
            className="sheet-panel"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-header">
              <div>
                <div className="eyebrow">
                  {editingEvent ? "Исправление" : "Новая запись"}
                </div>
                <h3>{currentAction.title}</h3>
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
                    className={
                      preset.id === selectedPresetId
                        ? "preset-card active"
                        : "preset-card"
                    }
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
                      onClick={() => void handleDeleteQuickItem(preset)}
                    >
                      Удалить
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <label className="field">
              <span>Время</span>
              <input
                type="time"
                value={timeValue}
                onChange={(event) => setTimeValue(event.target.value)}
              />
            </label>

            {currentPreset.inputLabel ? (
              <label className="field">
                <span>{currentPreset.inputLabel}</span>
                <input
                  type={currentPreset.inputType ?? "text"}
                  value={inputValue}
                  placeholder={currentPreset.inputPlaceholder}
                  onChange={(event) => setInputValue(event.target.value)}
                />
              </label>
            ) : null}

            {currentPreset.fields?.length ? (
              <div className="field-grid">
                {currentPreset.fields.map((field) => (
                  <label className="field" key={field.id}>
                    <span>{field.label}</span>
                    <input
                      type={field.inputType ?? "text"}
                      value={fieldValues[field.id] ?? ""}
                      placeholder={field.inputPlaceholder}
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

            <div className="sheet-footer">
              <PrimaryButton
                disabled={submitting}
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

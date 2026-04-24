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

import { actorLabel, formatDateTime, formatDuration, formatTime } from "@/lib/format";
import type { ActorId, CareEventKind, CareEventRecord, EventDraft, EventStatus, SummaryPeriodId } from "@/lib/types";
import { useCareDashboard } from "@/hooks/use-care-dashboard";
import { useThemePreference } from "@/hooks/use-theme-preference";

type TabId = "home" | "log" | "feed" | "summary" | "export";
type ActionId = "feeding" | "diaper" | "solid_food" | "sleep" | "medication" | "temperature" | "note" | "growth";

interface ActionPreset {
  id: string;
  label: string;
  helper: string;
  defaultInput?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputType?: "text" | "number";
  tone?: "default" | "warn" | "danger";
  buildDraft: (context: { actor: ActorId; occurredAt: string; inputValue: string }) => EventDraft;
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
        buildDraft: ({ actor, occurredAt, inputValue }) => ({
          kind: "MEDICATION",
          actor,
          occurredAt,
          summary: inputValue.trim() ? `Лекарство — ${inputValue.trim()}` : "Лекарство",
          payload: { medication: inputValue.trim() || "Лекарство", dose: inputValue.trim() || "без дозы" },
          status: "COMPLETED",
        }),
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
        defaultInput: "",
        inputLabel: "Вес и рост",
        inputPlaceholder: "4.2 кг, 54 см",
        inputType: "text",
        buildDraft: ({ actor, occurredAt, inputValue }) => {
          const value = inputValue.trim();
          const numbers = value.match(/\d+(?:[.,]\d+)?/g) ?? [];
          return {
            kind: "GROWTH",
            actor,
            occurredAt,
            summary: value ? `Вес и рост — ${value}` : "Вес и рост",
            payload: {
              note: value || "Измерение",
              weightKg: numbers[0] ? Number(numbers[0].replace(",", ".")) : null,
              heightCm: numbers[1] ? Number(numbers[1].replace(",", ".")) : null,
            },
            status: "LOGGED",
          };
        },
      },
    ],
  },
];

const actionOrder: ActionId[] = ["feeding", "diaper", "solid_food", "sleep", "medication", "temperature", "note", "growth"];
const orderedActions = actionOrder
  .map((id) => actions.find((action) => action.id === id))
  .filter((action): action is ActionDefinition => Boolean(action));

function actionById(id: ActionId | null): ActionDefinition | undefined {
  return actions.find((action) => action.id === id);
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
      return event.payload.type === "DIRTY" ? "dirty" : event.payload.type === "MIXED" ? "mixed" : "wet";
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
    return String(event.payload.durationMinutes ?? event.payload.volumeMl ?? "");
  }

  if (event.kind === "TEMPERATURE") {
    return String(event.payload.temperatureC ?? "");
  }

  if (event.kind === "SOLID_FOOD") {
    return String(event.payload.food ?? event.payload.note ?? "");
  }

  if (event.kind === "MEDICATION") {
    return String(event.payload.medication ?? event.payload.dose ?? "");
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
  if (event.kind === "TEMPERATURE" && Number(event.payload.temperatureC ?? 0) >= 37.5) {
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
    aiAnswer,
    error,
    changeActor,
    addEvent,
    editEvent,
    refreshSnapshot,
    refreshAi,
    downloadExport,
  } = useCareDashboard();
  const { theme, setTheme } = useThemePreference();

  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [sheetActionId, setSheetActionId] = useState<ActionId | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [inputValue, setInputValue] = useState("");
  const [timeValue, setTimeValue] = useState(toTimeInput(new Date().toISOString()));
  const [sheetActor, setSheetActor] = useState<ActorId>("mom");
  const [editingEvent, setEditingEvent] = useState<CareEventRecord | null>(null);
  const [summaryPeriodId, setSummaryPeriodId] = useState<SummaryPeriodId>("1d");
  const [submitting, setSubmitting] = useState(false);

  const currentAction = actionById(sheetActionId);
  const currentPreset = currentAction?.presets.find((preset) => preset.id === selectedPresetId) ?? currentAction?.presets[0];
  const canChangeActor = !actorLocked;

  const openCreateSheet = (actionId: ActionId) => {
    const action = actionById(actionId);
    const preset = action?.presets[0];
    setSheetActionId(actionId);
    setSelectedPresetId(preset?.id ?? "");
    setInputValue(preset?.defaultInput ?? "");
    setTimeValue(toTimeInput(new Date().toISOString()));
    setSheetActor(activeActor);
    setEditingEvent(null);
  };

  const openEditSheet = (event: CareEventRecord) => {
    const actionId = resolveActionId(event.kind);
    const action = actionById(actionId);
    const presetId = resolvePresetId(event);
    const preset = action?.presets.find((candidate) => candidate.id === presetId) ?? action?.presets[0];

    setSheetActionId(actionId);
    setSelectedPresetId(presetId);
    setInputValue(extractInputValue(event) || preset?.defaultInput || "");
    setTimeValue(toTimeInput(event.occurredAt));
    setSheetActor(activeActor);
    setEditingEvent(event);
  };

  const closeSheet = () => {
    setSheetActionId(null);
    setSelectedPresetId("");
    setInputValue("");
    setEditingEvent(null);
  };

  const handleSubmit = async () => {
    if (!currentAction || !currentPreset) {
      return;
    }

    if (currentPreset.inputType === "text" && currentAction.id === "note" && !inputValue.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const draft = currentPreset.buildDraft({
        actor: editingEvent ? editingEvent.actor : sheetActor,
        occurredAt: combineDateAndTime(editingEvent?.occurredAt ?? new Date().toISOString(), timeValue),
        inputValue,
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

  if (loading) {
    return (
      <div className="page-shell">
        <Card className="app-loading-card">
          <div className="loading-spinner" aria-hidden="true" />
          <div className="loading-copy">Собираю семейную ленту и свежие показатели…</div>
          <div className="loading-hint">Если Telegram Desktop держит окно открытым, ответ сервера ограничен таймаутом.</div>
        </Card>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="page-shell">
        <Card className="app-loading-card">
          <div className="empty-icon" aria-hidden="true">!</div>
          <div className="loading-copy">Не удалось открыть данные семьи</div>
          <div className="loading-hint">
            {error || "Проверьте интернет в Telegram и повторите загрузку. Локальные записи не удаляются."}
          </div>
          <div className="retry-row">
            <PrimaryButton onClick={() => void refreshSnapshot()}>Повторить</PrimaryButton>
          </div>
        </Card>
      </div>
    );
  }

  const activeSummary =
    snapshot.periodSummaries.find((summary) => summary.id === summaryPeriodId) ??
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

  const renderHome = () => (
    <>
      <section className="dashboard-section">
        <Card className="hero-card">
          <div className="hero-topline">
            <div>
              <div className="eyebrow">Панель ухода</div>
              <h1 className="hero-title">{snapshot.child.name}</h1>
              <div className="hero-subtitle">
                {snapshot.child.ageLabel} • семейный журнал здоровья, режима и назначений
              </div>
            </div>
            <div className="status-pills">
              <Pill tone={online ? "good" : "warn"}>{online ? "Онлайн" : "Оффлайн"}</Pill>
              {pendingCount > 0 ? <Pill tone="warn">В очереди: {pendingCount}</Pill> : null}
              {syncing ? <Pill tone="default">Синхронизация…</Pill> : null}
              <div className="theme-switch" aria-label="Тема приложения">
                <button
                  type="button"
                  className={theme === "dark" ? "theme-option active" : "theme-option"}
                  onClick={() => setTheme("dark")}
                >
                  Тёмная
                </button>
                <button
                  type="button"
                  className={theme === "light" ? "theme-option active" : "theme-option"}
                  onClick={() => setTheme("light")}
                >
                  Светлая
                </button>
              </div>
            </div>
          </div>

          <div className="actor-toggle">
            {canChangeActor ? (
              (["mom", "dad"] as ActorId[]).map((actor) => (
                <button
                  key={actor}
                  type="button"
                  onClick={() => changeActor(actor)}
                  className={actor === activeActor ? "actor-chip active" : "actor-chip"}
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
        </Card>
      </section>

      <section className="dashboard-section">
        <SectionTitle eyebrow="Сейчас" title="Главные показатели" />
        <div className="stats-grid">
          <StatTile label="Возраст" value={snapshot.overview.age} helper="от 0 мес до 3 лет" accent="#67e8f9" />
          <StatTile label="Последнее кормление" value={snapshot.overview.lastFeeding} helper="по журналу ухода" accent="#8b5cf6" />
          <StatTile label="Сон" value={snapshot.overview.sleepStatus} helper="таймер сна активен" accent="#60a5fa" />
          <StatTile label="Подгузник" value={snapshot.overview.diaperGap} helper="время с последней смены" accent="#f59e0b" />
          <StatTile label="Температура" value={snapshot.overview.temperature} helper="статистика и тревога" accent="#fb7185" />
          <StatTile label="Лекарства" value={snapshot.overview.medication} helper="последний приём" accent="#f97316" />
        </div>
      </section>

      <section className="dashboard-section dashboard-two-columns">
        <Card>
          <SectionTitle eyebrow="Основные действия" title="Одно нажатие ночью" />
          <div className="actions-grid">
            {orderedActions.map((action) => (
              <ActionButton
                key={action.id}
                icon={action.icon}
                title={action.title}
                subtitle={action.subtitle}
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
              value={snapshot.timers.sleepDurationMinutes ? formatDuration(snapshot.timers.sleepDurationMinutes) : "нет"}
              helper={snapshot.timers.sleepStartedAt ? `Старт в ${formatTime(snapshot.timers.sleepStartedAt)}` : "ребёнок не спит"}
            />
            <InlineMetric
              label="Следующее кормление"
              value={snapshot.timers.nextFeedingAt ? formatTime(snapshot.timers.nextFeedingAt) : "—"}
              helper="подсказка для напоминаний"
            />
            <InlineMetric
              label="Проверка подгузника"
              value={snapshot.timers.nextDiaperCheckAt ? formatTime(snapshot.timers.nextDiaperCheckAt) : "—"}
              helper="на основе последней смены"
            />
          </div>
        </Card>
      </section>

      <section className="dashboard-section dashboard-two-columns">
        <Card>
          <SectionTitle eyebrow="Лента семьи" title="Последние действия" action={<GhostButton onClick={() => setActiveTab("feed")}>Вся лента</GhostButton>} />
          <div className="timeline-list">
            {snapshot.events.length ? (
              snapshot.events.slice(0, 4).map((event) => (
                <TimelineItem
                  key={event.id}
                  title={event.summary}
                  subtitle={`${actorLabel(event.actor)} • ${event.kind.toLowerCase()}`}
                  meta={formatDateTime(event.occurredAt)}
                  accent={accentFromEvent(event.kind)}
                  action={<GhostButton onClick={() => openEditSheet(event)}>Исправить</GhostButton>}
                />
              ))
            ) : (
              <EmptyState title="Лента пока пустая" description="Здесь появятся только реальные действия мамы и папы." />
            )}
          </div>
        </Card>

        <Card>
          <SectionTitle eyebrow="Напоминания" title="Кому и когда напомнить" />
          <div className="stack-list">
            {snapshot.reminders.length ? (
              snapshot.reminders.map((reminder) => (
                <Surface key={reminder.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{reminder.title}</div>
                    <div style={{ marginTop: 4, color: "var(--muted-strong)" }}>
                      {reminder.channel === "bot" ? "Придёт в Telegram боте" : "Покажется в Mini App"}
                    </div>
                  </div>
                  <Pill tone={reminder.tone}>{reminder.dueLabel}</Pill>
                </Surface>
              ))
            ) : (
              <EmptyState title="Напоминаний пока нет" description="Они появятся после первых кормлений, подгузников или лекарств." />
            )}
          </div>
        </Card>
      </section>
    </>
  );

  const renderLog = () => (
    <section className="dashboard-section">
      <Card>
        <SectionTitle eyebrow="Запись событий" title="Минимум ввода, максимум скорости" />
        <div className="actions-grid">
          {orderedActions.map((action) => (
            <ActionButton
              key={action.id}
              icon={action.icon}
              title={action.title}
              subtitle={action.subtitle}
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
        <div className="timeline-list">
          {snapshot.events.length ? (
            snapshot.events.map((event) => (
              <Surface key={event.id} style={{ padding: 18 }}>
                <TimelineItem
                  title={event.summary}
                  subtitle={`${actorLabel(event.actor)} • ${event.kind.toLowerCase()}${event.editedAt ? " • исправлено" : ""}`}
                  meta={formatDateTime(event.occurredAt)}
                  accent={accentFromEvent(event.kind)}
                  action={<GhostButton onClick={() => openEditSheet(event)}>Исправить</GhostButton>}
                />
                <div style={{ marginTop: 14 }}>
                  <Pill tone={toneFromEvent(event)}>{event.source === "local" ? "Локально/синхронизируется" : "В базе семьи"}</Pill>
                </div>
              </Surface>
            ))
          ) : (
            <EmptyState title="Событий пока нет" description="Начните с кормления, сна или подгузника. Здесь не будет демо-записей." />
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
              className={summaryPeriodId === summary.id ? "period-tab active" : "period-tab"}
              onClick={() => setSummaryPeriodId(summary.id)}
            >
              {summary.title}
            </button>
          ))}
        </div>
        <div className="metrics-grid">
          {summaryMetrics.map((metric) => (
            <Surface key={metric.label} style={{ minHeight: 120 }}>
              <InlineMetric label={metric.label} value={metric.value} helper={metric.helper} />
            </Surface>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle eyebrow="Наблюдения" title="Подсказки по режиму" action={<GhostButton onClick={() => void refreshAi()}>Обновить</GhostButton>} />
        <div className="stack-list">
          <Surface>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Короткий ответ</div>
            <div style={{ marginTop: 8, color: "var(--muted-strong)", lineHeight: 1.6 }}>{aiAnswer}</div>
          </Surface>
          {snapshot.insights.map((insight) => (
            <Surface key={insight.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{insight.title}</div>
                <Pill tone={insight.tone}>{insight.tone === "danger" ? "Внимание" : insight.tone === "warn" ? "Следить" : "Норма"}</Pill>
              </div>
              <div style={{ marginTop: 8, color: "var(--muted-strong)", lineHeight: 1.6 }}>{insight.body}</div>
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
        <div className="stack-list">
          <Surface>
            <div style={{ fontSize: 18, fontWeight: 700 }}>PDF</div>
            <div style={{ marginTop: 8, color: "var(--muted-strong)", lineHeight: 1.6 }}>
              Аккуратная сводка по периодам, текущему статусу и событиям для врача.
            </div>
            <div style={{ marginTop: 16 }}>
              <PrimaryButton onClick={() => void downloadExport("pdf")}>Скачать PDF</PrimaryButton>
            </div>
          </Surface>
          <Surface>
            <div style={{ fontSize: 18, fontWeight: 700 }}>CSV</div>
            <div style={{ marginTop: 8, color: "var(--muted-strong)", lineHeight: 1.6 }}>
              CSV с периодами, событиями, родителем, временем и деталями для анализа.
            </div>
            <div style={{ marginTop: 16 }}>
              <PrimaryButton onClick={() => void downloadExport("csv")}>Скачать CSV</PrimaryButton>
            </div>
          </Surface>
        </div>
      </Card>

      <Card>
        <SectionTitle eyebrow="Риски и статус" title="Что важно помнить сейчас" />
        <div className="stack-list">
          <Surface>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Оффлайн-режим</div>
            <div style={{ marginTop: 8, color: "var(--muted-strong)", lineHeight: 1.6 }}>
              Даже без сети новые события не теряются: они сохраняются локально и уйдут в синхронизацию при следующем подключении.
            </div>
          </Surface>
          <Surface>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Текущая очередь</div>
            <div style={{ marginTop: 8, color: "var(--muted-strong)", lineHeight: 1.6 }}>
              В ожидании отправки: {pendingCount}. Онлайн-статус: {online ? "есть сеть" : "нет сети"}.
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
        return <EmptyState title="Пусто" description="Выберите раздел снизу." />;
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
      <BottomTabs items={tabs} activeId={activeTab} onChange={(value) => setActiveTab(value as TabId)} />

      {currentAction && currentPreset ? (
        <div className="sheet-backdrop" role="presentation" onClick={closeSheet}>
          <div className="sheet-panel" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-header">
              <div>
                <div className="eyebrow">{editingEvent ? "Исправление" : "Новая запись"}</div>
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
                      onClick={() => setSheetActor(actor)}
                      className={actor === sheetActor ? "actor-chip active" : "actor-chip"}
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
              {currentAction.presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={preset.id === selectedPresetId ? "preset-card active" : "preset-card"}
                  onClick={() => {
                    setSelectedPresetId(preset.id);
                    setInputValue(preset.defaultInput ?? "");
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{preset.label}</div>
                  <div style={{ marginTop: 6, color: "var(--muted-strong)", lineHeight: 1.5 }}>{preset.helper}</div>
                </button>
              ))}
            </div>

            <label className="field">
              <span>Время</span>
              <input type="time" value={timeValue} onChange={(event) => setTimeValue(event.target.value)} />
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

            <div className="sheet-footer">
              <PrimaryButton disabled={submitting} onClick={() => void handleSubmit()}>
                {submitting ? "Сохраняю…" : editingEvent ? "Сохранить исправление" : "Добавить событие"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

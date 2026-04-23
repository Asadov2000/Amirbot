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
import type { ActorId, CareEventKind, CareEventRecord, EventDraft, EventStatus } from "@/lib/types";
import { useCareDashboard } from "@/hooks/use-care-dashboard";

type TabId = "home" | "log" | "feed" | "summary" | "export";
type ActionId = "feeding" | "sleep" | "diaper" | "temperature" | "medication" | "note";

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
    subtitle: "Моча или кака",
    presets: [
      {
        id: "wet",
        label: "Моча",
        helper: "Быстрый отметчик",
        buildDraft: ({ actor, occurredAt }) => ({
          kind: "DIAPER",
          actor,
          occurredAt,
          summary: "Подгузник — моча",
          payload: { type: "WET" },
          status: "LOGGED",
        }),
      },
      {
        id: "dirty",
        label: "Кака",
        helper: "Отдельная отметка",
        buildDraft: ({ actor, occurredAt }) => ({
          kind: "DIAPER",
          actor,
          occurredAt,
          summary: "Подгузник — кака",
          payload: { type: "DIRTY" },
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
    id: "medication",
    kind: "MEDICATION",
    icon: "💊",
    title: "Лекарство",
    subtitle: "Два частых сценария",
    presets: [
      {
        id: "vitamin_d",
        label: "Витамин D",
        helper: "По умолчанию 1 капля",
        defaultInput: "1 капля",
        inputLabel: "Доза",
        inputType: "text",
        buildDraft: ({ actor, occurredAt, inputValue }) => ({
          kind: "MEDICATION",
          actor,
          occurredAt,
          summary: `Витамин D — ${inputValue || "1 капля"}`,
          payload: { medication: "Витамин D", dose: inputValue || "1 капля" },
          status: "COMPLETED",
        }),
      },
      {
        id: "paracetamol",
        label: "Парацетамол",
        helper: "Например 2.5 мл",
        defaultInput: "2.5 мл",
        inputLabel: "Доза",
        inputType: "text",
        buildDraft: ({ actor, occurredAt, inputValue }) => ({
          kind: "MEDICATION",
          actor,
          occurredAt,
          summary: `Парацетамол — ${inputValue || "2.5 мл"}`,
          payload: { medication: "Парацетамол", dose: inputValue || "2.5 мл" },
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
];

function actionById(id: ActionId | null): ActionDefinition | undefined {
  return actions.find((action) => action.id === id);
}

function resolveActionId(kind: CareEventKind): ActionId {
  switch (kind) {
    case "FEEDING":
      return "feeding";
    case "SLEEP":
      return "sleep";
    case "DIAPER":
      return "diaper";
    case "TEMPERATURE":
      return "temperature";
    case "MEDICATION":
      return "medication";
    case "NOTE":
    default:
      return "note";
  }
}

function resolvePresetId(event: CareEventRecord): string {
  switch (event.kind) {
    case "FEEDING":
      return event.payload.mode === "BOTTLE" ? "bottle" : "breast";
    case "SLEEP":
      return event.payload.phase === "END" ? "sleep_end" : "sleep_start";
    case "DIAPER":
      return event.payload.type === "DIRTY" ? "dirty" : "wet";
    case "TEMPERATURE":
      return "temperature";
    case "MEDICATION":
      return String(event.payload.medication).toLowerCase().includes("парацет")
        ? "paracetamol"
        : "vitamin_d";
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

  if (event.kind === "MEDICATION") {
    return String(event.payload.dose ?? "");
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
    case "SLEEP":
      return "#8b5cf6";
    case "DIAPER":
      return "#f59e0b";
    case "TEMPERATURE":
      return "#fb7185";
    case "MEDICATION":
      return "#f97316";
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
    refreshAi,
    downloadExport,
  } = useCareDashboard();

  const [activeTab, setActiveTab] = useState<TabId>("home");
  const [sheetActionId, setSheetActionId] = useState<ActionId | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [inputValue, setInputValue] = useState("");
  const [timeValue, setTimeValue] = useState(toTimeInput(new Date().toISOString()));
  const [sheetActor, setSheetActor] = useState<ActorId>("mom");
  const [editingEvent, setEditingEvent] = useState<CareEventRecord | null>(null);
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

  if (loading || !snapshot) {
    return (
      <div className="page-shell">
        <Card style={{ minHeight: 260, display: "grid", placeItems: "center" }}>
          <div className="loading-copy">Собираю семейную ленту и свежие показатели…</div>
        </Card>
      </div>
    );
  }

  const summaryMetrics = [
    {
      label: "Кормлений",
      value: String(snapshot.summary.feedingsCount),
      helper: "за сегодня",
    },
    {
      label: "Общий сон",
      value: formatDuration(snapshot.summary.totalSleepMinutes),
      helper: "с начала суток",
    },
    {
      label: "Средний интервал",
      value: formatDuration(snapshot.summary.averageFeedingIntervalMinutes),
      helper: "между кормлениями",
    },
    {
      label: "Подгузники",
      value: `${snapshot.summary.diaperWetCount + snapshot.summary.diaperDirtyCount}`,
      helper: `моча ${snapshot.summary.diaperWetCount} • кака ${snapshot.summary.diaperDirtyCount}`,
    },
  ];

  const renderHome = () => (
    <>
      <section className="dashboard-section">
        <Card className="hero-card">
          <div className="hero-topline">
            <div>
              <div className="eyebrow">Mini App для семьи</div>
              <h1 className="hero-title">{snapshot.child.name}</h1>
              <div className="hero-subtitle">
                {snapshot.child.ageLabel} • Telegram Mini App • ночной режим по умолчанию
              </div>
            </div>
            <div className="status-pills">
              <Pill tone={online ? "good" : "warn"}>{online ? "Онлайн" : "Оффлайн"}</Pill>
              {pendingCount > 0 ? <Pill tone="warn">В очереди: {pendingCount}</Pill> : null}
              {syncing ? <Pill tone="default">Синхронизация…</Pill> : null}
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
          <StatTile label="Последнее кормление" value={snapshot.overview.lastFeeding} helper="быстрый ответ для AI" accent="#8b5cf6" />
          <StatTile label="Сон" value={snapshot.overview.sleepStatus} helper="таймер сна активен" accent="#60a5fa" />
          <StatTile label="Подгузник" value={snapshot.overview.diaperGap} helper="время с последней смены" accent="#f59e0b" />
          <StatTile label="Температура" value={snapshot.overview.temperature} helper="статистика и тревога" accent="#fb7185" />
          <StatTile label="Лекарства" value={snapshot.overview.medication} helper="последний приём" accent="#f97316" />
        </div>
      </section>

      <section className="dashboard-section dashboard-two-columns">
        <Card>
          <SectionTitle eyebrow="Быстрый лог" title="Одно нажатие ночью" />
          <div className="actions-grid">
            {actions.map((action) => (
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
          {actions.map((action) => (
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
        <SectionTitle eyebrow="День" title="Сводка дня" />
        <div className="metrics-grid">
          {summaryMetrics.map((metric) => (
            <Surface key={metric.label} style={{ minHeight: 120 }}>
              <InlineMetric label={metric.label} value={metric.value} helper={metric.helper} />
            </Surface>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle eyebrow="AI" title="Подсказки по режиму" action={<GhostButton onClick={() => void refreshAi()}>Обновить</GhostButton>} />
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
              Дневная или недельная выжимка с кормлениями, сном, температурой и лекарствами.
            </div>
            <div style={{ marginTop: 16 }}>
              <PrimaryButton onClick={() => void downloadExport("pdf")}>Скачать PDF</PrimaryButton>
            </div>
          </Surface>
          <Surface>
            <div style={{ fontSize: 18, fontWeight: 700 }}>CSV</div>
            <div style={{ marginTop: 8, color: "var(--muted-strong)", lineHeight: 1.6 }}>
              Табличный экспорт всех событий для анализа и передачи врачу.
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

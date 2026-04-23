import { actorLabels, type ActorId } from "./types";

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatTime(value?: string): string {
  if (!value) {
    return "—";
  }

  return timeFormatter.format(new Date(value));
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

export function formatDuration(totalMinutes?: number): string {
  if (!totalMinutes || totalMinutes <= 0) {
    return "0 мин";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} мин`;
  }

  if (minutes === 0) {
    return `${hours} ч`;
  }

  return `${hours} ч ${minutes} мин`;
}

export function formatRelativeFromNow(value?: string): string {
  if (!value) {
    return "нет данных";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes <= 1) {
    return "только что";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} мин назад`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    const restMinutes = diffMinutes % 60;
    return restMinutes === 0 ? `${diffHours} ч назад` : `${diffHours} ч ${restMinutes} мин назад`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} д назад`;
}

export function formatDueLabel(value?: string): string {
  if (!value) {
    return "без срока";
  }

  const diffMs = new Date(value).getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes <= 0) {
    return "сейчас";
  }

  if (diffMinutes < 60) {
    return `через ${diffMinutes} мин`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  const restMinutes = diffMinutes % 60;
  return restMinutes === 0 ? `через ${diffHours} ч` : `через ${diffHours} ч ${restMinutes} мин`;
}

export function calculateAgeLabel(birthDate: string): string {
  const birth = new Date(birthDate);
  const now = new Date();
  const birthDay = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate());
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.max(0, Math.floor((currentDay.getTime() - birthDay.getTime()) / 86_400_000));
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());

  if (now.getDate() < birth.getDate()) {
    months -= 1;
  }

  if (months < 0) {
    months = 0;
  }

  if (months === 0) {
    if (diffDays < 14) {
      return `${diffDays} дн`;
    }

    const weeks = Math.max(1, Math.floor(diffDays / 7));
    return `${weeks} нед`;
  }

  const years = Math.floor(months / 12);
  const restMonths = months % 12;

  if (years === 0) {
    return `${restMonths} мес`;
  }

  if (restMonths === 0) {
    return `${years} г`;
  }

  return `${years} г ${restMonths} мес`;
}

export function actorLabel(actor: ActorId): string {
  return actorLabels[actor];
}

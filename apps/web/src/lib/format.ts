import { actorLabels, type ActorId } from "./types";

const TZ = "Europe/Moscow";

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
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

/**
 * Полная разбивка возраста ребёнка для красивого отображения на главной.
 * - primary: основная единица (дни/недели/месяцы/годы) — крупно.
 * - secondary: всегда показывает точное «N дней» — родители любят считать.
 * - milestone: ближайшая «круглая» отметка (1 неделя, 1 месяц, 100 дней, 1 год…)
 *   с количеством оставшихся дней — превращает экран в живой счётчик.
 */
export interface AgeBreakdown {
  totalDays: number;
  weeks: number;
  months: number;
  years: number;
  primary: string;
  primaryUnit: string;
  secondary: string;
  milestone: { label: string; daysLeft: number } | null;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function calculateAgeBreakdown(birthDate: string): AgeBreakdown {
  const birth = new Date(birthDate);
  const now = new Date();
  const birthDay = new Date(birth.getFullYear(), birth.getMonth(), birth.getDate());
  const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const totalDays = Math.max(
    0,
    Math.floor((currentDay.getTime() - birthDay.getTime()) / 86_400_000),
  );
  const weeks = Math.floor(totalDays / 7);
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const restMonths = months % 12;

  // Основная и вторая строка
  let primary: string;
  let primaryUnit: string;
  let secondary: string;

  if (totalDays < 14) {
    // 0–13 дней — основная цифра «дни»
    primary = String(totalDays);
    primaryUnit = plural(totalDays, "день", "дня", "дней");
    secondary = totalDays === 0 ? "родился сегодня" : `${weeks > 0 ? weeks + " нед · " : ""}малыш`;
  } else if (months < 2) {
    // 2–8 недель
    const restDays = totalDays - weeks * 7;
    primary = String(weeks);
    primaryUnit = plural(weeks, "неделя", "недели", "недель");
    secondary = `${totalDays} ${plural(totalDays, "день", "дня", "дней")}` +
      (restDays > 0 ? ` · +${restDays}` : "");
  } else if (years === 0) {
    primary = String(months);
    primaryUnit = plural(months, "месяц", "месяца", "месяцев");
    secondary = `${totalDays} ${plural(totalDays, "день", "дня", "дней")}`;
  } else {
    primary = restMonths > 0 ? `${years} г ${restMonths} мес` : `${years} ${plural(years, "год", "года", "лет")}`;
    primaryUnit = "";
    secondary = `${totalDays} ${plural(totalDays, "день", "дня", "дней")}`;
  }

  // Ближайшая «круглая» дата как живой счётчик
  const milestonesAll = [
    { days: 7, label: "1 неделя" },
    { days: 14, label: "2 недели" },
    { days: 21, label: "3 недели" },
    { days: 30, label: "1 месяц" },
    { days: 60, label: "2 месяца" },
    { days: 90, label: "3 месяца" },
    { days: 100, label: "100 дней" },
    { days: 180, label: "полгода" },
    { days: 270, label: "9 месяцев" },
    { days: 365, label: "1 год" },
    { days: 540, label: "1.5 года" },
    { days: 730, label: "2 года" },
    { days: 1095, label: "3 года" },
  ];
  const upcoming = milestonesAll.find((m) => m.days > totalDays);
  const milestone = upcoming
    ? { label: upcoming.label, daysLeft: upcoming.days - totalDays }
    : null;

  return {
    totalDays,
    weeks,
    months,
    years,
    primary,
    primaryUnit,
    secondary,
    milestone,
  };
}

export function actorLabel(actor: ActorId): string {
  return actorLabels[actor];
}

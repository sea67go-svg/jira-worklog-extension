const WEEKDAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function mondayOf(date: Date): Date {
  const d = startOfLocalDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function weekdayLabel(date: Date): string {
  const idx = (date.getDay() + 6) % 7;
  return WEEKDAY_SHORT[idx];
}

export function weekdayUpper(date: Date): string {
  return weekdayLabel(date).toUpperCase();
}

export function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatClockFromStarted(started: string): string {
  return formatClock(parseJiraStarted(started));
}

export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function formatEntrySpan(started: string, timeSpentSeconds: number): string {
  const start = parseJiraStarted(started);
  const end = addSeconds(start, timeSpentSeconds);
  return `${formatClock(start)}–${formatClock(end)}`;
}

export function formatDaySpan(entries: { started: string; timeSpentSeconds: number }[]): string {
  if (!entries.length) return "";
  const starts = entries.map((e) => parseJiraStarted(e.started).getTime());
  const ends = entries.map(
    (e) => parseJiraStarted(e.started).getTime() + e.timeSpentSeconds * 1000,
  );
  return `${formatClock(new Date(Math.min(...starts)))}–${formatClock(new Date(Math.max(...ends)))}`;
}

export function formatDateDot(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function isoWeekNumber(date: Date): number {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function projectKey(issueKey: string): string {
  return issueKey.split("-")[0] || issueKey;
}

export function formatHoursDecimal(seconds: number): string {
  if (!seconds) return "0 ч";
  const hours = Math.round((seconds / 3600) * 10) / 10;
  return `${hours.toLocaleString("ru-RU")} ч`;
}

export function formatDayShort(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

export function formatDayHeading(date: Date): string {
  return `${weekdayLabel(date)} ${formatDayShort(date)}`;
}

export function weekKeys(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toDateKey(addDays(weekStart, i)));
}

export function formatJiraStarted(date: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const ms = pad(date.getMilliseconds(), 3);
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const oh = pad(Math.floor(abs / 60));
  const om = pad(abs % 60);
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}.${ms}${sign}${oh}${om}`;
}

export function parseJiraStarted(value: string): Date {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:([+-]\d{2}):?(\d{2})|Z)?/,
  );
  if (!match) {
    const fallback = new Date(value);
    if (Number.isNaN(fallback.getTime())) {
      throw new Error(`Не удалось разобрать дату: ${value}`);
    }
    return fallback;
  }
  const [, ys, ms, ds, hs, mins, ss, frac, tzh, tzm] = match;
  const msPart = frac ? Number(frac.padEnd(3, "0").slice(0, 3)) : 0;
  if (!tzh) {
    return new Date(
      Number(ys),
      Number(ms) - 1,
      Number(ds),
      Number(hs),
      Number(mins),
      Number(ss),
      msPart,
    );
  }
  const utc =
    Date.UTC(
      Number(ys),
      Number(ms) - 1,
      Number(ds),
      Number(hs),
      Number(mins),
      Number(ss),
      msPart,
    ) -
    (Number(tzh) * 60 + Number(tzm || "0")) * 60_000;
  return new Date(utc);
}

export function dateKeyFromStarted(started: string): string {
  return toDateKey(parseJiraStarted(started));
}

export function dateKeysForStarted(started: string): string[] {
  const keys = new Set<string>();
  if (/^\d{4}-\d{2}-\d{2}/.test(started)) {
    keys.add(started.slice(0, 10));
  }
  try {
    keys.add(dateKeyFromStarted(started));
  } catch {
    /* ignore */
  }
  return [...keys];
}

export function withDateKeepingTime(started: string, dateKey: string): string {
  const original = parseJiraStarted(started);
  const day = parseDateKey(dateKey);
  day.setHours(
    original.getHours(),
    original.getMinutes(),
    original.getSeconds(),
    original.getMilliseconds(),
  );
  return formatJiraStarted(day);
}

export function formatHours(seconds: number): string {
  if (!seconds) return "0ч";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h && m) return `${h}ч ${m}м`;
  if (h) return `${h}ч`;
  return `${m}м`;
}

export function secondsToJira(seconds: number): string {
  const safe = Math.max(60, Math.round(seconds / 60) * 60);
  const h = Math.floor(safe / 3600);
  const m = Math.round((safe % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function parseTimeInput(value: string): string {
  const raw = value.trim().toLowerCase().replace(",", ".");
  if (!raw) throw new Error("Укажите время");
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const hours = Number(raw);
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error("Время должно быть больше 0");
    }
    return secondsToJira(hours * 3600);
  }
  if (/^(\d+h)?\s*(\d+m)?$/.test(raw.replace(/\s+/g, "")) || /[hm]/.test(raw)) {
    const h = Number(/(\d+)\s*h/.exec(raw)?.[1] || 0);
    const m = Number(/(\d+)\s*m/.exec(raw)?.[1] || 0);
    if (h === 0 && m === 0) throw new Error("Не удалось разобрать время");
    return secondsToJira(h * 3600 + m * 60);
  }
  throw new Error("Формат: 1.5 или 1h 30m");
}

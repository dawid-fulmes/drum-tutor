import type { LocalDate } from "@drum-tutor/contracts";

export const STATS_PERIODS = ["week", "month", "year"] as const;
export type StatsPeriod = (typeof STATS_PERIODS)[number];

/*
 * Dates are `YYYY-MM-DD` strings. They are turned into UTC midnights for arithmetic and formatted in
 * UTC, never parsed with `new Date(string)` in the local zone, so no time zone can shift a day.
 */
export function parseDate(date: LocalDate): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year as number, (month as number) - 1, day as number));
}

export function formatDate(date: Date): LocalDate {
  return date.toISOString().slice(0, 10);
}

const addDays = (date: Date, days: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));

const utc = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options });
const monthDay = utc({ month: "short", day: "numeric" });
const monthDayYear = utc({ month: "short", day: "numeric", year: "numeric" });
const monthYear = utc({ month: "long", year: "numeric" });

/** Week (Monday–Sunday), calendar month or calendar year containing `date`. */
export function periodRange(
  period: StatsPeriod,
  date: LocalDate,
): { from: LocalDate; to: LocalDate } {
  const d = parseDate(date);
  if (period === "week") {
    const monday = addDays(d, -((d.getUTCDay() + 6) % 7));
    return { from: formatDate(monday), to: formatDate(addDays(monday, 6)) };
  }
  if (period === "month") {
    const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return { from: formatDate(first), to: formatDate(last) };
  }
  return { from: `${d.getUTCFullYear()}-01-01`, to: `${d.getUTCFullYear()}-12-31` };
}

/** The first day of the previous or next period. */
export function shiftPeriod(period: StatsPeriod, date: LocalDate, direction: 1 | -1): LocalDate {
  const start = parseDate(periodRange(period, date).from);
  if (period === "week") return formatDate(addDays(start, 7 * direction));
  if (period === "month") {
    return formatDate(
      new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + direction, 1)),
    );
  }
  return `${start.getUTCFullYear() + direction}-01-01`;
}

export function periodLabel(period: StatsPeriod, date: LocalDate): string {
  const { from, to } = periodRange(period, date);
  const start = parseDate(from);
  const end = parseDate(to);
  if (period === "year") return String(start.getUTCFullYear());
  if (period === "month") return monthYear.format(start);
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return `${monthDayYear.format(start)} – ${monthDayYear.format(end)}`;
  }
  return `${monthDay.format(start)} – ${monthDayYear.format(end)}`;
}

/** The period contains today or lies after it, so there is nothing newer to page to. */
export function isLatestPeriod(period: StatsPeriod, date: LocalDate, today: LocalDate): boolean {
  return periodRange(period, date).to >= today;
}

export const formatMonthDay = (date: LocalDate) => monthDay.format(parseDate(date));
export const formatWeekdayMonthDay = (date: LocalDate) =>
  utc({ weekday: "short", month: "short", day: "numeric" }).format(parseDate(date));
export const formatWeekday = (date: LocalDate) => utc({ weekday: "short" }).format(parseDate(date));
export const formatMonthShort = (date: LocalDate) =>
  utc({ month: "short" }).format(parseDate(date));

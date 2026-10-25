import type { DailyStats, LocalDate, WeeklyStats } from "@drum-tutor/contracts";
import {
  formatMonthDay,
  formatMonthShort,
  formatWeekday,
  formatWeekdayMonthDay,
  parseDate,
} from "./stats-period";

/** One bar. `minutes` is null for days or weeks after today: no bar and no tooltip (spec §6.3). */
export type ChartRow = { key: string; tick: string; tooltip: string; minutes: number | null };

/** Seconds from the API as minutes with at most one decimal. */
export function toMinutes(seconds: number): number {
  return Math.round(seconds / 6) / 10;
}

export function formatMinutes(minutes: number): string {
  return `${minutes} min`;
}

export function dailyRows(
  period: "week" | "month",
  stats: DailyStats,
  today: LocalDate,
): ChartRow[] {
  return stats.days.map((day) => ({
    key: day.date,
    tick: period === "week" ? formatWeekday(day.date) : String(parseDate(day.date).getUTCDate()),
    tooltip: formatWeekdayMonthDay(day.date),
    minutes: day.date > today ? null : toMinutes(day.seconds),
  }));
}

/** Year view: one bar per (clipped) week; the week holding a month's 1st carries the month tick. */
export function weeklyRows(stats: WeeklyStats, today: LocalDate): ChartRow[] {
  return stats.weeks.map((week) => {
    const firstOfMonth = `${week.to.slice(0, 7)}-01`;
    const holdsMonthStart = firstOfMonth >= week.from && firstOfMonth <= week.to;
    return {
      key: week.from,
      tick: holdsMonthStart ? formatMonthShort(firstOfMonth) : "",
      tooltip: `${formatMonthDay(week.from)} – ${formatMonthDay(week.to)}`,
      minutes: week.from > today ? null : toMinutes(week.seconds),
    };
  });
}

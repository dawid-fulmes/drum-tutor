import type { LocalDate } from "@drum-tutor/contracts";

const pad = (n: number) => String(n).padStart(2, "0");

/** The browser's local calendar date, `YYYY-MM-DD` (R12: a log's day is the user's local day). */
export function toLocalDate(date: Date): LocalDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayLocal(): LocalDate {
  return toLocalDate(new Date());
}

import { z } from "zod";

const LOCAL_DATE_MESSAGE = "Date must be a valid YYYY-MM-DD date";
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC midnight of a `YYYY-MM-DD` date, so day arithmetic is not skewed by DST. */
function utcMidnight(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  // setUTCFullYear, unlike Date.UTC, does not map years 0–99 to 1900–1999.
  return new Date(0).setUTCFullYear(year as number, (month as number) - 1, day as number);
}

/** Earliest date the API accepts; earlier dates are client bugs and some break Postgres or the driver. */
export const MIN_LOCAL_DATE = "2000-01-01";

/** A calendar date without time zone, `YYYY-MM-DD` (R12, ADR-0007). */
export const LocalDateSchema = z
  .string(LOCAL_DATE_MESSAGE)
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: LOCAL_DATE_MESSAGE, abort: true })
  .refine((date) => new Date(utcMidnight(date)).toISOString().slice(0, 10) === date, {
    message: LOCAL_DATE_MESSAGE,
    abort: true,
  })
  .refine((date) => date >= MIN_LOCAL_DATE, `Date must be ${MIN_LOCAL_DATE} or later`);
export type LocalDate = string;

/** True for a valid `YYYY-MM-DD` calendar date. Refinements use it to skip already-invalid input. */
export function isLocalDate(value: string): boolean {
  return LocalDateSchema.safeParse(value).success;
}

/** Signed number of whole days from `from` to `to`. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / DAY_MS);
}

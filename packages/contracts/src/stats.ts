import { z } from "zod";
import { daysBetween, isLocalDate, LocalDateSchema } from "./dates";

/** Longest range, inclusive, each stats endpoint accepts (ADR-0043). */
export const STATS_RANGE_DAYS = { daily: 31, weekly: 366 } as const;

// Malformed dates already have their own issue; Zod 4 still runs object refinements then.
const validRange = (q: { from: string; to: string }) => isLocalDate(q.from) && isLocalDate(q.to);

function statsQuerySchema(maxDays: number) {
  return z
    .object({ tagId: z.uuid(), from: LocalDateSchema, to: LocalDateSchema })
    .refine((q) => !validRange(q) || daysBetween(q.from, q.to) >= 0, {
      path: ["from"],
      message: "Start date must not be after end date",
    })
    .refine((q) => !validRange(q) || daysBetween(q.from, q.to) < maxDays, {
      path: ["to"],
      message: `Range can be at most ${maxDays} days`,
    });
}

export const DailyStatsQuerySchema = statsQuerySchema(STATS_RANGE_DAYS.daily);
export const WeeklyStatsQuerySchema = statsQuerySchema(STATS_RANGE_DAYS.weekly);
export type StatsQuery = z.output<typeof DailyStatsQuerySchema>;

const SecondsSchema = z.number().int().min(0);

export const DailyStatsSchema = z.object({
  tagId: z.uuid(),
  from: LocalDateSchema,
  to: LocalDateSchema,
  days: z.array(z.object({ date: LocalDateSchema, seconds: SecondsSchema })),
});
export type DailyStats = z.infer<typeof DailyStatsSchema>;

export const WeeklyStatsSchema = z.object({
  tagId: z.uuid(),
  from: LocalDateSchema,
  to: LocalDateSchema,
  /** Monday–Sunday weeks clipped to [from, to] (ADR-0041). */
  weeks: z.array(z.object({ from: LocalDateSchema, to: LocalDateSchema, seconds: SecondsSchema })),
});
export type WeeklyStats = z.infer<typeof WeeklyStatsSchema>;

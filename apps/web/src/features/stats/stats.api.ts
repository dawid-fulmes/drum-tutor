import {
  ApiPaths,
  DailyStatsSchema,
  type StatsQuery,
  WeeklyStatsSchema,
} from "@drum-tutor/contracts";
import { queryOptions } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";

/** `all` is the root a saved practice log invalidates (plan 02). */
export const statsKeys = {
  all: ["stats"] as const,
  daily: (q: StatsQuery) => [...statsKeys.all, "daily", q] as const,
  weekly: (q: StatsQuery) => [...statsKeys.all, "weekly", q] as const,
};

export const dailyStatsQueryOptions = (q: StatsQuery) =>
  queryOptions({
    queryKey: statsKeys.daily(q),
    queryFn: () => apiRequest(ApiPaths.statsDaily, { query: q, schema: DailyStatsSchema }),
  });

export const weeklyStatsQueryOptions = (q: StatsQuery) =>
  queryOptions({
    queryKey: statsKeys.weekly(q),
    queryFn: () => apiRequest(ApiPaths.statsWeekly, { query: q, schema: WeeklyStatsSchema }),
  });

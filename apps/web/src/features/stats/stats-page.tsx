import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";
import { QueryError } from "@/components/query-error";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useTagsByIds } from "@/features/tags/tags.api";
import { ApiClientError } from "@/lib/api-client";
import { todayLocal } from "@/lib/local-date";
import { dailyRows, weeklyRows } from "./chart-rows";
import { dailyStatsQueryOptions, weeklyStatsQueryOptions } from "./stats.api";
import { StatsChart } from "./stats-chart";
import { periodLabel, periodRange } from "./stats-period";
import type { StatsSearch } from "./stats-search";
import { StatsToolbar } from "./stats-toolbar";

const route = getRouteApi("/_authenticated/_app/stats");

/** Minutes practiced for one tag per day (week, month) or per week (year) — spec §6.3. */
export function StatsPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const { tagId, period, date } = search;

  const query = { tagId: tagId ?? "", ...periodRange(period, date) };
  const daily = useQuery({
    ...dailyStatsQueryOptions(query),
    enabled: tagId !== undefined && period !== "year",
  });
  const weekly = useQuery({
    ...weeklyStatsQueryOptions(query),
    enabled: tagId !== undefined && period === "year",
  });
  const stats = period === "year" ? weekly : daily;
  const tags = useTagsByIds(tagId ? [tagId] : []);
  const tagName = tags.data?.find((tag) => tag.id === tagId)?.name;

  const change = (patch: Partial<StatsSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }) });

  // A tag that no longer exists leaves the URL (replace), which shows the empty state.
  const tagMissing =
    (tagId !== undefined && tags.isSuccess && !tags.data.some((tag) => tag.id === tagId)) ||
    (stats.error instanceof ApiClientError && stats.error.status === 404);
  useEffect(() => {
    if (!tagMissing) return;
    void navigate({ search: (prev) => ({ ...prev, tagId: undefined }), replace: true });
  }, [tagMissing, navigate]);

  const today = todayLocal();
  const rows =
    period === "year"
      ? weekly.data && weeklyRows(weekly.data, today)
      : daily.data && dailyRows(period, daily.data, today);

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">Stats</h1>
      <StatsToolbar search={search} onChange={change} />
      {tagId === undefined || tagMissing ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Select a tag to see your stats</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : stats.isError && !stats.data ? (
        <QueryError error={stats.error} onRetry={() => stats.refetch()} />
      ) : !rows ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <StatsChart
          rows={rows}
          label={`Minutes practiced${tagName ? ` for ${tagName}` : ""}, ${periodLabel(period, date)}`}
        />
      )}
    </div>
  );
}

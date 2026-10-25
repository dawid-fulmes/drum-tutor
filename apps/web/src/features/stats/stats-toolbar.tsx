import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TagSelect } from "@/features/tags/tag-select";
import { todayLocal } from "@/lib/local-date";
import { isLatestPeriod, periodLabel, STATS_PERIODS, shiftPeriod } from "./stats-period";
import type { StatsSearch } from "./stats-search";

const PERIOD_LABELS = { week: "Week", month: "Month", year: "Year" } as const;

type StatsToolbarProps = {
  search: StatsSearch;
  onChange: (patch: Partial<StatsSearch>) => void;
};

export function StatsToolbar({ search, onChange }: StatsToolbarProps) {
  const { period, date } = search;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <TagSelect value={search.tagId} onChange={(tagId) => onChange({ tagId })} />
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label="Period"
        value={period}
        // Switching the period keeps the date, so a week opens as its month or year.
        onValueChange={(next) => {
          const selected = STATS_PERIODS.find((p) => p === next);
          if (selected) onChange({ period: selected });
        }}
      >
        {STATS_PERIODS.map((p) => (
          <ToggleGroupItem key={p} value={p}>
            {PERIOD_LABELS[p]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous period"
          onClick={() => onChange({ date: shiftPeriod(period, date, -1) })}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <span className="min-w-48 text-center text-sm font-medium tabular-nums">
          {periodLabel(period, date)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next period"
          disabled={isLatestPeriod(period, date, todayLocal())}
          onClick={() => onChange({ date: shiftPeriod(period, date, 1) })}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

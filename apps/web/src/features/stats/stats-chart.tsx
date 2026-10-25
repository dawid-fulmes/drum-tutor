import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { type ChartRow, formatMinutes } from "./chart-rows";

const chartConfig = {
  minutes: { label: "Minutes", color: "var(--chart-1)" },
} satisfies ChartConfig;

type TooltipProps = { active?: boolean; payload?: { payload?: ChartRow }[] };

function RowTooltip({ active, payload }: TooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row || row.minutes === null) return null;
  return (
    <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {row.tooltip} · {formatMinutes(row.minutes)}
    </div>
  );
}

/** Minutes per day or week, exactly as the API returned them (ADR-0043); no totals (PRD non-goal). */
export function StatsChart({ rows, label }: { rows: ChartRow[]; label: string }) {
  return (
    <ChartContainer config={chartConfig} className="h-72 w-full" role="img" aria-label={label}>
      {/* The chart is one labelled image; Recharts' keyboard layer would add a hidden tab stop inside it. */}
      <BarChart data={rows} margin={{ left: 0, right: 8 }} accessibilityLayer={false}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="tick" tickLine={false} axisLine={false} interval={0} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          label={{ value: "min", angle: -90, position: "insideLeft" }}
        />
        <ChartTooltip cursor={false} content={<RowTooltip />} />
        <Bar dataKey="minutes" fill="var(--color-minutes)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

# Practice and Stats — Plan 03: Stats UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
- **Status:** done

**Goal:** Spec §6.3: a `/stats` screen with a single-select tag picker, Week / Month / Year, paging between periods, and a bar chart of minutes per day (week, month) or per week (year), with all state in the URL. Then close the scope (PRD ticks, statuses) once plan 02 is done too.

**Architecture:** Period math and chart rows are pure functions over `YYYY-MM-DD` strings, unit-tested: never `new Date("YYYY-MM-DD")`, all arithmetic on UTC components. A Zod `validateSearch` schema parses the URL. The page derives the API range from `(period, date)` and asks `GET /api/stats/daily` or `/weekly`, and the chart only maps the API series to bars (ADR-0043). The tag picker's list body is extracted once and shared by the existing multi-select `TagPicker` and the new single-select `TagSelect`. The chart is the stock shadcn `chart` component on Recharts (ADR-0046).

**Tech Stack:** React 19, TanStack Router / Query, shadcn/ui + `chart` (Recharts), Vitest 5 for pure functions.

**Spec:** [spec.md](spec.md) · **Depends on:** [plan-01-backend.md](plan-01-backend.md) done. Independent of [plan-02-player-ui.md](plan-02-player-ui.md), except Task 5 Step 3 (scope closure), which waits for plan 02.

## Global Constraints

- [spec.md](spec.md) wins over this plan if they disagree. Raise the conflict instead of picking one silently.
- **Git:** commit only when the user explicitly asks (their global rule). Each task ends with a checkpoint; if the user has asked for per-task commits, commit that task's files to `main` with a short imperative message and no AI attribution. Never branch, push, stash, rebase or reset.
- Run every `pnpm` command through `scripts/with-node.sh`.
- The only new dependency is `recharts`, brought in by the stock shadcn `chart` component (ADR-0046). Pin it to an exact version that already satisfies pnpm's `minimumReleaseAge`. Do not add a `minimumReleaseAgeExclude` entry: that would need its own ADR (see ADR-0029).
- The UI never aggregates logs, fills missing days or sums periods. It shows the API series as is. The only client-side rule is blanking days and weeks after today (spec §6.3).
- No totals, averages or other numbers next to the chart (PRD non-goal).
- Date strings are never parsed with `new Date(string)` or formatted in the local zone. Use `Date.UTC` / `getUTC*` and `Intl.DateTimeFormat("en-US", { timeZone: "UTC", … })`. "Today" is `todayLocal()`, the browser's local date.
- Stats query keys live under `statsKeys.all = ["stats"]` (plan 02 invalidates that root after a saved log).
- Run `scripts/with-node.sh pnpm format` before closing each task.
- Any shortcut or `TODO` needs a tech-debt ADR, and the comment must read `// TODO(ADR-NNNN): …`.

**Exact copy** (spec §6.3):

| Where                        | Text                                                               |
| ---------------------------- | ------------------------------------------------------------------ |
| page heading, header link    | `Stats`                                                            |
| period toggle                | `Week` / `Month` / `Year`                                          |
| picker trigger without a tag | `Select a tag`                                                     |
| empty state without a tag    | `Select a tag to see your stats`                                   |
| week label                   | `Oct 19 – Oct 25, 2026`; across years `Dec 28, 2026 – Jan 3, 2027` |
| month / year label           | `October 2026` / `2026`                                            |
| week ticks                   | `Mon` … `Sun`                                                      |
| tooltip, day                 | `Sat, Oct 24 · 25 min`                                             |
| tooltip, week (year view)    | `Dec 28 – Dec 31 · 45 min`                                         |
| minutes                      | at most one decimal: `12.5 min`, `25 min`, `0 min`                 |
| pager buttons (aria-label)   | `Previous period` / `Next period`                                  |

## Review Focus

1. **Weeks across a month or year end.** Paging through `2026-12-28 … 2027-01-03` must request exactly that range (daily), label it `Dec 28, 2026 – Jan 3, 2027`, and the next page must start on `2027-01-04`. Unit-tested in Task 1.
2. **Month paging from a long month.** From `date=2026-01-31`, "›" must land in February (not March) and "‹" in December 2025. Unit-tested in Task 1.
3. **Negative UTC offsets.** In a browser west of UTC, labels and ranges must not shift a day (the `new Date("2026-10-25")` trap). Unit tests run with `process.env.TZ = "America/Los_Angeles"` set in the test file before imports. Task 1.
4. **Garbage URLs.** `?period=decade&date=2026-02-30&tagId=x` must render the current week without a tag, never an error page. Unit-tested in Task 1, checked in Task 5.
5. **A deleted tag in the URL.** The `tagId` must be dropped with `replace` (no extra history entry), showing the empty state. A `404 Tag not found` from the stats call (tag deleted after the lookup) does the same. Checked in Task 5.

---

### Task 1: Period math, chart rows and the search schema

**Files:**
- Create: `apps/web/src/lib/local-date.ts` (skip if plan 02 already created it with the same interface), `apps/web/src/features/stats/stats-period.ts`, `apps/web/src/features/stats/chart-rows.ts`, `apps/web/src/features/stats/stats-search.ts`
- Test: `apps/web/src/lib/local-date.test.ts` (if created here), `apps/web/src/features/stats/stats-period.test.ts`, `apps/web/src/features/stats/chart-rows.test.ts`, `apps/web/src/features/stats/stats-search.test.ts`

**Interfaces:**
- Produces:
  - `local-date.ts`: `toLocalDate(date: Date): LocalDate`, `todayLocal(): LocalDate` (same as plan 02 Task 1).
  - `stats-period.ts`:
    - `STATS_PERIODS = ["week", "month", "year"] as const`, `type StatsPeriod`.
    - `periodRange(period: StatsPeriod, date: LocalDate): { from: LocalDate; to: LocalDate }`. A week is the Monday–Sunday containing `date`; a month and a year are calendar ones.
    - `shiftPeriod(period: StatsPeriod, date: LocalDate, direction: 1 | -1): LocalDate` returns the **first day** of the neighbouring period.
    - `periodLabel(period: StatsPeriod, date: LocalDate): string` (copy table).
    - `isLatestPeriod(period: StatsPeriod, date: LocalDate, today: LocalDate): boolean` is `periodRange(...).to >= today` (disables "›").
  - `chart-rows.ts`:
    - `type ChartRow = { key: string; tick: string; tooltip: string; minutes: number | null }`.
    - `toMinutes(seconds: number): number` is `Math.round(seconds / 6) / 10`; `formatMinutes(minutes: number): string` gives `"12.5 min"` / `"25 min"`.
    - `dailyRows(period: "week" | "month", stats: DailyStats, today: LocalDate): ChartRow[]`. The key is the date. The tick is `Mon`…`Sun` (week) or the day of the month (month). The tooltip label is `Sat, Oct 24`. `minutes` is `null` when `date > today`.
    - `weeklyRows(stats: WeeklyStats, today: LocalDate): ChartRow[]`. The key is `from`. The tick is the month abbreviation (`Jan`…) when the week contains a month's 1st, otherwise `""`. The tooltip label is `Dec 28 – Dec 31`. `minutes` is `null` when `from > today`.
  - `stats-search.ts`: `statsSearchSchema = z.object({ tagId: z.uuid().optional().catch(undefined), period: z.enum(STATS_PERIODS).default("week").catch("week"), date: LocalDateSchema.default(todayLocal).catch(todayLocal) })` (function defaults, so "today" is evaluated per parse). `type StatsSearch`.

- [x] **Step 1: Write the failing tests.** At the top of each stats test file, before imports: `process.env.TZ = "America/Los_Angeles";` (Review Focus 3).

```ts
// stats-period.test.ts
expect(periodRange("week", "2026-10-25")).toEqual({ from: "2026-10-19", to: "2026-10-25" }); // Sunday
expect(periodRange("week", "2026-10-19")).toEqual({ from: "2026-10-19", to: "2026-10-25" }); // Monday
expect(periodRange("week", "2027-01-01")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
expect(periodRange("month", "2024-02-10")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
expect(periodRange("year", "2026-06-15")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
expect(shiftPeriod("week", "2026-12-30", 1)).toBe("2027-01-04");
expect(shiftPeriod("month", "2026-01-31", 1)).toBe("2026-02-01");
expect(shiftPeriod("month", "2026-01-31", -1)).toBe("2025-12-01");
expect(shiftPeriod("year", "2026-06-15", -1)).toBe("2025-01-01");
expect(periodLabel("week", "2026-10-22")).toBe("Oct 19 – Oct 25, 2026");
expect(periodLabel("week", "2026-09-30")).toBe("Sep 28 – Oct 4, 2026");
expect(periodLabel("week", "2027-01-01")).toBe("Dec 28, 2026 – Jan 3, 2027");
expect(periodLabel("month", "2026-10-22")).toBe("October 2026");
expect(periodLabel("year", "2026-10-22")).toBe("2026");
expect(isLatestPeriod("week", "2026-10-20", "2026-10-25")).toBe(true);
expect(isLatestPeriod("week", "2026-10-12", "2026-10-25")).toBe(false);
expect(isLatestPeriod("year", "2027-03-01", "2026-10-25")).toBe(true); // future periods too

// chart-rows.test.ts — daily stats for 2026-10-19..25 with seconds [0, 1500, 0, 750, 0, 0, 0], today 2026-10-22
expect(dailyRows("week", stats, "2026-10-22").map((r) => [r.tick, r.minutes])).toEqual([
  ["Mon", 0],
  ["Tue", 25],
  ["Wed", 0],
  ["Thu", 12.5],
  ["Fri", null],
  ["Sat", null],
  ["Sun", null],
]);
expect(dailyRows("week", stats, "2026-10-22")[5]?.tooltip).toBe("Sat, Oct 24");
expect(dailyRows("month", octoberStats, "2026-12-01")[0]?.tick).toBe("1");
// weekly stats for 2026 (first entry 2026-01-01..04, last 2026-12-28..31)
const rows = weeklyRows(year2026, "2026-10-25");
expect(rows[0]?.tick).toBe("Jan");
expect(rows[0]?.tooltip).toBe("Jan 1 – Jan 4");
expect(rows.at(-1)?.tooltip).toBe("Dec 28 – Dec 31");
expect(rows.find((r) => r.key === "2026-10-26")?.minutes).toBeNull();
expect(rows.find((r) => r.key === "2026-10-19")?.minutes).not.toBeNull();
expect(rows.filter((r) => r.tick !== "").map((r) => r.tick)).toEqual([
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]);
expect(toMinutes(90)).toBe(1.5);
expect(formatMinutes(25)).toBe("25 min");
expect(formatMinutes(12.5)).toBe("12.5 min");

// stats-search.test.ts
const parsed = statsSearchSchema.parse({});
expect(parsed).toEqual({ tagId: undefined, period: "week", date: todayLocal() });
expect(statsSearchSchema.parse({ period: "decade", date: "2026-02-30", tagId: "x" })).toEqual({
  tagId: undefined,
  period: "week",
  date: todayLocal(),
});
expect(statsSearchSchema.parse({ period: "year", date: "2025-03-04", tagId: A }).date).toBe(
  "2025-03-04",
);
```

- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/web test`. Expected: FAIL, modules missing.
- [x] **Step 3: Implement** the modules. Use one private helper pair in `stats-period.ts`: `parse(date) → Date` via `Date.UTC`, and `format(Date) → LocalDate` via `toISOString().slice(0, 10)`. `chart-rows.ts` reuses it.
- [x] **Step 4: Run** the web tests. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Commit if the user asked for per-task commits.

### Task 2: Chart component and stats queries

**Files:**
- Create (via shadcn): `apps/web/src/components/ui/chart.tsx`; modify `apps/web/package.json` (`recharts`, exact version) and `pnpm-lock.yaml`
- Create: `apps/web/src/features/stats/stats.api.ts`, `apps/web/src/features/stats/stats-chart.tsx`

**Interfaces:**
- Consumes: Task 1 `ChartRow`, `formatMinutes`; contracts `DailyStatsSchema`, `WeeklyStatsSchema`, `StatsQuery`, `ApiPaths.statsDaily/statsWeekly`.
- Produces:
  - `stats.api.ts`: `statsKeys = { all: ["stats"] as const, daily: (q: StatsQuery) => [...statsKeys.all, "daily", q] as const, weekly: (q: StatsQuery) => [...statsKeys.all, "weekly", q] as const }`; `dailyStatsQueryOptions(q: StatsQuery)`, `weeklyStatsQueryOptions(q: StatsQuery)` (`apiRequest` with `query: q` and the response schema).
  - `StatsChart({ rows }: { rows: ChartRow[] })`: a `ChartContainer` with one series `minutes` (label "Minutes", `var(--chart-1)`) and a `BarChart`. The X axis uses `tick` with `interval={0}`, so the year view shows only month ticks (the others are `""`). The Y axis is in minutes. A custom tooltip shows `` `${row.tooltip} · ${formatMinutes(row.minutes)}` `` and renders nothing for `minutes === null`. Bars with `null` are not drawn. The chart has an `aria-label` describing the period and tag.

- [x] **Step 1: Add the component.** `scripts/with-node.sh pnpm --filter @drum-tutor/web exec shadcn add chart`. Then pin `recharts` in `apps/web/package.json` to the exact installed version. If pnpm refuses because of `minimumReleaseAge`, install the newest version old enough instead (`pnpm add recharts@<version> --filter @drum-tutor/web`), and record the chosen version in Execution notes. Check that the Biome override for vendored shadcn files (ADR-0037) covers `chart.tsx`.
- [x] **Step 2: Implement** `stats.api.ts` and `stats-chart.tsx`.
- [x] **Step 3: Run** `scripts/with-node.sh pnpm typecheck && scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm --filter @drum-tutor/web test`. Expected: PASS. Then `scripts/with-node.sh pnpm --filter @drum-tutor/web build`. Expected: build succeeds.
- [x] **Step 4: Checkpoint.** `pnpm format`. Commit if the user asked for per-task commits.

### Task 3: Single-select tag picker

**Files:**
- Create: `apps/web/src/features/tags/tag-search-list.tsx`, `apps/web/src/features/tags/tag-select.tsx`
- Modify: `apps/web/src/features/tags/tag-picker.tsx` (use `TagSearchList`; behaviour unchanged)

**Interfaces:**
- Produces:
  - `TagSearchList({ selectedIds, onSelect, multiselect }: { selectedIds: readonly string[]; onSelect: (tag: Tag) => void; multiselect: boolean })`. It is the `Command` body moved out of `TagPicker` unchanged: the search input (debounced `q`, max 50), skeleton, `QueryError`, `No tags found`, items and `LoadMoreSentinel`. Items show a `Checkbox` when `multiselect`, otherwise a `Check` icon on the selected one. The list has `aria-multiselectable` only when `multiselect`.
  - `TagSelect({ value, onChange }: { value: string | undefined; onChange: (id: string) => void })`: a Popover with a `combobox` trigger showing the tag's name, resolved with `useTagsByIds(value ? [value] : [])`, or `Select a tag`. Selecting a tag calls `onChange` and closes the popover. It lists all tags (spec §6.3).

- [x] **Step 1: Extract `TagSearchList`** from `TagPicker` and switch `TagPicker` to it. `TagPicker` stays behaviourally identical: the trigger text, toggling and the checkbox items.
- [x] **Step 2: Implement `TagSelect`.**
- [x] **Step 3: Run** `scripts/with-node.sh pnpm typecheck && scripts/with-node.sh pnpm lint`. Expected: PASS. In the browser (seeded, logged in), the library's tag picker still searches, scrolls, toggles and shows "Tags (n)", as in the local-dev skill's library flow 2.
- [x] **Step 4: Checkpoint.** `pnpm format`. Commit if the user asked for per-task commits.

### Task 4: Stats page, route and header link

**Files:**
- Create: `apps/web/src/routes/_authenticated/_app/stats.tsx` (`validateSearch: statsSearchSchema`, component `StatsPage`), `apps/web/src/features/stats/stats-page.tsx`, `apps/web/src/features/stats/stats-toolbar.tsx`
- Modify: `apps/web/src/routes/_authenticated/_app.tsx` (a `Stats` link after `Library`), `apps/web/src/routeTree.gen.ts` (regenerated by the router plugin)

**Interfaces:**
- Consumes: Tasks 1–3; `useTagsByIds`; `QueryError`; shadcn `Empty`, `ToggleGroup`, `Button`, `Skeleton`.
- Produces: `StatsPage()`.

- [x] **Step 1: Build the page.**
  - Read the search with `getRouteApi("/_authenticated/_app/stats").useSearch()`. Changes go through `navigate({ search })`: the period toggle keeps `date`, and the pager sets `date: shiftPeriod(...)`.
  - Toolbar: `TagSelect`, then `ToggleGroup` type single for Week / Month / Year, then "‹ {periodLabel} ›". "›" is disabled when `isLatestPeriod(period, date, todayLocal())`.
  - **Without `tagId`:** `Empty` with `Select a tag to see your stats`, and no stats request.
  - **With `tagId`:** `const range = periodRange(period, date)`. Use the weekly query for `year` and the daily one otherwise, with `{ tagId, ...range }`. While there is no data, show a `Skeleton` the chart's height. On error, show `QueryError` (except as below). Otherwise render `StatsChart` with `dailyRows` / `weeklyRows` and `todayLocal()`.
  - **Unknown tag** (Review Focus 5): when `useTagsByIds([tagId])` succeeds with no item, or the stats query fails with `404` / `NOT_FOUND`, `navigate({ search: (prev) => ({ ...prev, tagId: undefined }), replace: true })`. Use an effect guarded like the library's tag-pruning effect.
  - Heading `Stats`. No totals or other numbers.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm typecheck && scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm --filter @drum-tutor/web test`. Expected: PASS.
- [x] **Step 3: Checkpoint.** `pnpm format`. Commit if the user asked for per-task commits.

### Task 5: Browser verification, local-dev skill and scope closure

**Files:**
- Modify: `.claude/skills/local-dev/SKILL.md` (new "Stats flows (e2e)" section)
- Modify: this plan (ticks, status, execution notes); when plan 02 is done also `docs/PRD.md`, `docs/specs/practice-and-stats/spec.md`, `docs/specs/README.md`

- [x] **Step 1: Run each flow** with the app started and seeded (`scripts/with-node.sh pnpm db:seed`), logged in as `seed@example.com` (the seed's practice history belongs to that user):
  1. The header shows `Stats`. `/stats` shows the URL with `period=week&date=<today>` and the empty state `Select a tag to see your stats`. `browser_network_requests` shows no `/api/stats` call.
  2. Pick `Groove`. Expect `tagId` in the URL, one `GET /api/stats/daily` for Monday–Sunday of this week, 7 bars labelled Mon…Sun, and no bars after today. Hovering a past bar shows `<Day>, <Mon> <d> · <n> min`.
  3. `Month`: one daily call for the calendar month and the label `<Month> <year>`. `Year`: one weekly call for 1 Jan – 31 Dec, month ticks, and a tooltip like `Dec 28 – Dec 31 · 0 min` on a past week.
  4. **Paging.** "‹" twice in Year view shows the previous years. Last year has data (the seed spans 13 months). "›" is disabled on the current period. A week crossing New Year (e.g. `?period=week&date=2027-01-01`) is labelled `Dec 28, 2026 – Jan 3, 2027` (Review Focus 1). From `?period=month&date=2026-01-31`, "›" shows February 2026 (Review Focus 2).
  5. **URL state.** Refresh keeps tag, period and date. Back/forward restore them. Switching period from a week keeps the date.
  6. **Garbage URL:** `/stats?period=decade&date=2026-02-30&tagId=x` shows the current week without a tag (Review Focus 4).
  7. **Deleted tag** (Review Focus 5). Create a tag in `/admin/tags`, select it in Stats (all zeros), delete it in another tab, then reload Stats. Expect `tagId` gone (replace: one Back leaves the page) and the empty state.
  8. **Fresh practice shows up.** If plan 02 is done: complete a 0:30 session on a Groove lesson, return to Stats (Week). Today's bar includes the extra 0.5 min without a manual reload of data (the query was invalidated).
  9. **Loading and error.** Delay `**/api/stats/**` by 2 s (`page.route`): a chart-sized skeleton shows. Abort it: an inline `Could not load data` with `Try again`.
- [x] **Step 2: Update the local-dev skill** with a "Stats flows (e2e)" section containing flows 1–9.
- [x] **Step 3: Close the scope (only when [plan-02-player-ui.md](plan-02-player-ui.md) is `done`; otherwise leave this step unticked and say so in Execution notes):**
  - **`docs/PRD.md`:** tick US-7, US-8, US-9, US-10, US-11, US-11a, US-11b, US-14 and US-15, and add `practice-and-stats` to the "delivered by" sentence in §5. Under §5.6 rules add: "The year view shows weekly totals (Monday–Sunday weeks clipped to the year), see ADR-0041." US-6 stays unticked.
  - **`spec.md`:** set the status to `implemented`.
  - **`docs/specs/README.md`:** set the spec to `implemented` and all three plans to `(done)`.
- [x] **Step 4: Run** `scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm typecheck && scripts/with-node.sh pnpm test && scripts/with-node.sh pnpm --filter @drum-tutor/web build`. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Tick this plan's checkboxes, set its status to `done` and update `docs/specs/README.md`. Commit if the user asked.

## Execution notes

<!-- Filled in during execution: the recharts version chosen, decisions taken while building and browser-check observations. -->

- **Commits.** No per-task commits; the user commits on request (global rule).
- **Task 1.** `stats-period.ts` also exports `parseDate`, `formatDate` and the UTC formatters reused by `chart-rows.ts`. A test asserts that the stats tests really run west of UTC (`America/Los_Angeles`).
- **Task 2.**
  - `recharts` 3.8.0, pinned exactly by the shadcn CLI. pnpm installed it without a `minimumReleaseAgeExclude` entry.
  - The stock `chart.tsx` sets inner HTML for its CSS variables. `security/noDangerouslySetInnerHtml` is now off in the existing `components/ui/**` Biome override (ADR-0049, extends ADR-0037).
  - `StatsChart` takes a `label` prop for its `aria-label`.
- **Task 3.** The search text state lives in `TagPicker` / `TagSelect` and is passed into `TagSearchList`. Radix unmounts popover content on close, and the original picker kept the text between opens. One difference remains: the tag search query now starts when the popover opens instead of on page load, because the list mounts only inside the open popover.
- **Task 5 (browser, Chromium through the Playwright plugin, 2026-10-25).** All 9 flows behaved as expected:
  - Week, month and year requested the right ranges.
  - Month ticks and tooltips showed, nothing after today was drawn, and the year-crossing week label and the Jan 31 → February paging were right.
  - Garbage URLs fell back to defaults, and a deleted tag left the URL with `replace`.
  - A fresh 0:30 session showed up as +0.5 min.
  - The skeleton, error and retry states appeared as expected.
  - The library's tag picker still works.

  "Invalid hook call" errors appeared once, right after `recharts` was added while the dev server was running (Vite re-optimized deps on first import). They did not come back after a fresh load.
- **Final review (Opus) fix.** `BarChart` has `accessibilityLayer={false}`. Recharts 3 made the `<svg>` focusable (`role="application"`, `tabindex=0`) inside the `role="img"` container, with its focus ring hidden by the stock chart styles. Browser check: before `tabindex="0"`, after none.
- **Scope closure.** Plan 02 is done, so the PRD ticks, the year-view note in §5.6 and the `implemented` statuses are in this change.

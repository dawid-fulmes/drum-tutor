# Practice and Stats — Spec

- **Status:** approved
- **Date:** 2026-10-25
- **Related:** PRD US-7, US-8, US-9, US-10, US-11, US-11a, US-11b, US-14, US-15; R1, R2, R6, R10, R11, R12; ADR-0006, ADR-0007, ADR-0009, ADR-0016, ADR-0030, ADR-0034, ADR-0040 – ADR-0048
- **Plans:** [plan-01-backend.md](plan-01-backend.md), plan-02-player-ui.md and plan-03-stats-ui.md (not written yet)

## 1. Intent

This is the third MVP scope. It closes the loop the PRD exists for: a drummer opens a lesson, sets tempo and duration, practices with a metronome, the completed session is logged, and the drummer sees how much they practice each skill area (tag) over weeks, months and years.

Two things that sit next to this work stay out on purpose:

- **The signature (notation)** stays a separate scope. The lesson page keeps the "Sheet coming soon" placeholder, and the player is sound only: no beat indicator, no visual click. The visual beat will be designed together with the signature. This changes the repayment trigger of ADR-0030, which assumed the signature would land before or with the player (ADR-0040).
- **Rating** (US-12, US-13) stays a separate scope. Nothing in this scope reads or shows ratings.

The path from the previous scopes applies unchanged: Zod contract in `packages/contracts` → Fastify route validated by it → Drizzle schema and migration → TanStack Query in the SPA → integration tests on real PostgreSQL.

## 2. Goals, non-goals, anti-goals

**Goals**

- On the lesson page `/lessons/$lessonId`, the drummer sets tempo and duration (pre-filled with the lesson's recommended values) and presses **Start** (US-7).
- Four count-in clicks at the chosen tempo, then a click on every quarter note with an accent on beat 1, and a countdown timer of the chosen duration. Count-in time is not part of the duration (US-8, US-9, R2).
- **Stop** at any time; nothing is logged (US-10, R1). Hiding the page (tab switch, screen lock, app to background), reloading it or leaving it counts as a stop (US-11a).
- When the timer reaches zero the session completes and one practice log is saved (US-11, R1). A failed save is reported and retried without creating duplicates (US-11b).
- A stats screen `/stats`: pick a tag and a period (week, month, year), see minutes practiced for that tag, page to the previous / next period (US-14, US-15, R6, R12). Week and month show one bar per day; year shows one bar per week (ADR-0041).
- Seed data that makes the stats screen worth looking at without practicing for weeks first.

**Non-goals (this scope)**

- The signature in any form, and any visual beat indicator during play (ADR-0040).
- Rating in any form (ADR-0031 stays as it is).
- Pause (PRD non-goal).
- Totals, averages, streaks or goals on the stats screen (PRD non-goal "additional statistics"). The chart is the only number display.
- Stats across all tags at once, or comparing tags.
- A history list of past sessions.
- Logging stopped or interrupted sessions in any form (PRD non-goal, ADR-0009).
- A visual design pass (PRD §7). Screens use stock shadcn/ui components.
- A committed Playwright suite (ADR-0027 stays open).
- Mobile and tablet support. The app is desktop-first: there is no screen wake lock, so an auto-locking phone or tablet stops the session like any other hidden page (ADR-0047).
- Offline support. An unsaved log survives only while the page stays open; there is no local buffer that resends it later (ADR-0045).

**Anti-goals** — the scope fails if any of these happen, even if it "works"

- A stopped, interrupted or reloaded session leaves a practice log (R1).
- Count-in time is included in a logged duration, or the logged duration differs from the duration the user chose (R2).
- A completed session is logged twice because a save was retried (US-11b).
- A completed session's log is silently lost: the user is never told it was not saved.
- A log moves to another day after it was saved, e.g. when stats are viewed in another time zone (R12, ADR-0007).
- The stats screen shows time the user did not practice, or practice of other users.
- The frontend aggregates logs into days or weeks, or fills missing days with zeros itself; the API returns the finished series.
- The metronome tempo drifts audibly from the chosen BPM because clicks are timed with JS timers instead of the audio clock (ADR-0016).
- A log is created for a draft lesson, or a lesson gets a log between an admin's lock check and write (ADR-0034).

## 3. Constraints

- Everything in [TECH_STACK.md](../../TECH_STACK.md) and the accepted ADRs applies, plus the patterns established in [project-foundation](../project-foundation/spec.md) and [lessons-and-tags](../lessons-and-tags/spec.md): error shape (ADR-0022), global mutation error toasts with opt-out through `meta` (ADR-0021), thin fetch client (ADR-0025), URL search params validated with `.default().catch()`, `401` redirects to `/login`, integration tests on real PostgreSQL (ADR-0018).
- Every new endpoint requires a logged-in user (`requireUser`) and only ever reads or writes that user's logs.
- Metronome on the Web Audio API with a look-ahead scheduler, no audio library (ADR-0016).
- The chart uses Recharts through the stock shadcn `chart` component (TECH_STACK names Recharts; adding it is recorded in ADR-0046).
- Code, docs, UI text and test data in English.

## 4. Data model (`packages/db`)

One migration changes `practice_logs` (created in `lessons-and-tags`, ADR-0034):

| Change                                                                 | Why                                                                                                                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| add `idempotency_key uuid not null`                                    | US-11b: a retried save carries the same key (ADR-0042). Existing rows (seed, tests) get `gen_random_uuid()` in the migration; the column has no default afterwards. |
| unique index on `(user_id, idempotency_key)`                           | The database is the final guard against duplicate logs.                                                                                                             |
| index on `(user_id, local_date) include (lesson_id, duration_seconds)` | The stats query (§5.3) reads one user's logs by local date range from the index alone.                                                                              |

Nothing else changes. Durations stay in seconds; `local_date` stays the day a log belongs to (R12).

**Seed.** `pnpm db:seed` keeps everything it does today and adds, for `seed@example.com`, practice logs spread over the **last 13 months** (so the previous year and the current one both have data), on **three** published lessons that together cover at least four tags. Roughly 3–5 sessions a week with gaps of several days, so zero days are visible. Each log's `local_date` is consistent with its `completed_at`. The other published lessons stay without logs, so the admin can still edit, delete and unpublish lessons on the seeded data. The lesson that is locked today stays one of the three. The three logged lessons get a `created_at` older than their first log (about 14 months ago), so no log predates its lesson; the remaining lessons keep today's spread over the last ~30 days.

## 5. API contract (`packages/contracts`)

### 5.1 Shared shapes

```ts
LocalDate = string  // "YYYY-MM-DD", a valid calendar date, 2000-01-01 or later

PracticeLogInput = {
  idempotencyKey: string;   // uuid, generated by the client once per completed session (ADR-0042)
  lessonId: string;         // uuid
  durationSeconds: number;  // integer 30–3600, multiple of 30 (R10) — the duration the user chose
  tempoBpm: number;         // integer 30–300 (R10)
  completedAt: string;      // ISO 8601 date-time with offset, the moment the timer reached zero, 2000-01-01 or later
  localDate: LocalDate;     // the user's local calendar date at completedAt (R12, ADR-0007)
}

PracticeLog = {
  id: string;
  lessonId: string;
  durationSeconds: number;
  tempoBpm: number;
  completedAt: string;      // ISO 8601, UTC
  localDate: LocalDate;
}

StatsQuery = {
  tagId: string;   // uuid
  from: LocalDate; // inclusive
  to: LocalDate;   // inclusive, from <= to
}

DailyStats = {
  tagId: string;
  from: LocalDate;
  to: LocalDate;
  days: { date: LocalDate; seconds: number }[];  // one entry per day from..to, ascending, 0 for days without practice
}

WeeklyStats = {
  tagId: string;
  from: LocalDate;
  to: LocalDate;
  weeks: { from: LocalDate; to: LocalDate; seconds: number }[];
  // Monday–Sunday weeks, clipped to [from, to]: the first and last entry may be shorter than 7 days.
  // One entry per week touching the range, ascending, 0 for weeks without practice.
}
```

The stats series are in **seconds**, like every stored duration (R10). The UI converts to minutes for display (ADR-0043).

No new error codes. Unknown or unpublished lessons and unknown tags use `NOT_FOUND`; everything else is `VALIDATION_ERROR` (ADR-0022).

### 5.2 Endpoints

| Method & path             | Request            | Success                                                 | Errors                                                                         |
| ------------------------- | ------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `POST /api/practice-logs` | `PracticeLogInput` | `201 PracticeLog`; `200 PracticeLog` for a repeated key | `400 VALIDATION_ERROR`, `404 NOT_FOUND` (unknown or draft lesson), `401`       |
| `GET /api/stats/daily`    | `StatsQuery`       | `200 DailyStats`                                        | `400` (incl. range longer than 31 days), `404 NOT_FOUND` (unknown tag), `401`  |
| `GET /api/stats/weekly`   | `StatsQuery`       | `200 WeeklyStats`                                       | `400` (incl. range longer than 366 days), `404 NOT_FOUND` (unknown tag), `401` |

Paths are added to `ApiPaths`; all routes are registered with their schemas so they appear in `/api/docs`.

**`POST /api/practice-logs` rules**

- **Idempotency (ADR-0042).** If the current user already has a log with this `idempotencyKey`, return it with `200` and change nothing, whatever the rest of the body says. Otherwise insert and return `201`. Two concurrent requests with the same key produce one row: the unique index decides, and the loser returns the existing row with `200`.
- **Lesson.** Inside one transaction, load the lesson with `SELECT … FOR SHARE` (conflicts with the admin's `FOR UPDATE`, ADR-0034). Unknown or `draft` lesson → `404 NOT_FOUND` (R11: only published lessons can be practiced). The idempotency lookup happens first, so a retry of an already saved log still returns `200` even if the lesson was unpublished meanwhile — it cannot be, since it now has a log.
- **Duration and tempo** follow R10 exactly (schema-level, as in `LessonInput`).
- **Time checks (ADR-0007).** `completedAt` must not be more than 5 minutes in the future of the server clock. `localDate` must be within one day of the UTC calendar date of `completedAt` (the same day, the day before or the day after). Violations are `400 VALIDATION_ERROR` with a `details` entry on the field.
- The log stores `completedAt` and `localDate` as sent. The server never recomputes `localDate`.

**Stats rules (R6, R12, ADR-0006, ADR-0043)**

- Only the current user's logs count.
- A log counts toward a tag when its lesson has that tag; it counts with its **full** `durationSeconds` (R6). Lessons with logs are locked (R7), so a log's tags never change afterwards.
- Logs are bucketed by their stored `local_date` only; `completed_at` is not used for bucketing.
- Every day (daily) or week (weekly) in the range is present, with `0` when there is no practice.
- Weekly buckets are Monday–Sunday, clipped to the requested range (ADR-0041). Example: `from=2026-01-01&to=2026-12-31` returns 53 entries, the first `2026-01-01…2026-01-04` (Thu–Sun), the last `2026-12-28…2026-12-31`.
- Range limits: daily at most 31 days, weekly at most 366 days, both inclusive. `from > to`, malformed dates or a longer range → `400`.
- An unknown `tagId` → `404 NOT_FOUND`. A tag that exists but has no lessons or no logs → `200` with all zeros.
- One SQL query per request, shaped as in §5.3; no per-day queries.

### 5.3 Stats query (ADR-0048)

Stats are aggregated on read from `practice_logs`; there is no summary or snapshot table. Each stats request runs one SQL query:

1. **Tag check.** The tag must exist; otherwise the endpoint returns `404 NOT_FOUND`. This may be a CTE in the same query or a cheap lookup before it.
2. **Logs in range.** `practice_logs` filtered by `user_id = current user` and `local_date between from and to`. This is a range scan on the `(user_id, local_date)` index, which also carries `lesson_id` and `duration_seconds`, so the table itself is not read.
3. **Tag filter.** Inner join with `lesson_tags` on `lesson_tags.lesson_id = practice_logs.lesson_id and lesson_tags.tag_id = :tagId`, served by the `lesson_tags` primary key `(lesson_id, tag_id)`. Each log matches at most once, so its full duration counts once for the tag (R6).
4. **Grouping.** Daily: `group by local_date`, `sum(duration_seconds)`. Weekly: group by the Monday of the log's week (`date_trunc('week', local_date)`).
5. **Series.** The database generates the full series and left-joins the sums, with `coalesce(sum, 0)`. Daily: `generate_series(from, to, '1 day')`. Weekly: one row per Monday from the Monday of `from`'s week up to `to`, with each bucket's bounds clipped to `greatest(monday, from)` … `least(monday + 6, to)`.

Expected volume: with 20 sessions a day, a year is about 7,300 logs per user, and the query only ever touches one user's rows. The number of users does not affect a request's cost.

**Performance check.** An integration test seeds one user with 20 logs a day for a full year, spread over lessons with several tags, plus logs of another user. It asserts that `GET /api/stats/weekly` for that year returns correct totals and responds within **200 ms** on the Testcontainers database (measured after one warm-up request). The builder also checks the query plan with `EXPLAIN` during implementation and records in the plan that the index is used.

## 6. Web app (`apps/web`)

### 6.1 Routes and navigation

| Route                | Screen                                                       |
| -------------------- | ------------------------------------------------------------ |
| `/lessons/$lessonId` | lesson details + practice (setup, count-in, playing, result) |
| `/stats`             | stats                                                        |

The drummer header gets a **Stats** link after **Library**.

### 6.2 Lesson page and player

The page keeps everything it shows today (back link, name, badges, recommended tempo and duration, description, "Sheet coming soon" box). Below the sheet box, the disabled Start button is replaced by the practice panel. The practice panel is a state machine local to the page; nothing about it is in the URL or persisted.

**States**

| State           | What the panel shows                                                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup`         | Tempo control and duration control (below), and a primary **Start** button.                                                                                                      |
| `count-in`      | The chosen tempo ("90 BPM"), the timer showing the full duration (not yet running), the label "Count-in", and **Stop**.                                                          |
| `playing`       | The chosen tempo, the countdown timer (`m:ss`, from the chosen duration down to `0:00`), and **Stop**.                                                                           |
| `saving`        | "Completed" with "Saving your session…".                                                                                                                                         |
| `saved`         | "Completed — {m:ss} at {bpm} BPM logged." and a **Practice again** button that returns to `setup` with the same tempo and duration.                                              |
| `save-failed`   | "Completed, but your session isn't saved yet. Retrying…" with a **Retry now** button; retries continue in the background (below).                                                |
| `save-rejected` | For a non-retryable error: "Your session couldn't be saved: {reason}" and **Practice again**. `404` → "This lesson is no longer available."                                      |
| `stopped`       | Back in `setup`. When the stop was automatic (page hidden, audio interrupted), a short inline note: "Session stopped because the app was in the background. Nothing was logged." |

No visual beat indicator in any state (ADR-0040). The metronome is sound only.

**Controls (`setup`)**

- **Tempo:** Slider 30–300 step 1 with a synced number Input ("BPM"), the same behaviour as the admin `TempoField`. Default: the lesson's recommended tempo.
- **Duration:** read-only `m:ss` between "−" and "+" buttons, ±30 s, disabled at 0:30 / 60:00, the same behaviour as the admin `DurationField`. Default: the lesson's recommended duration.
- Both are validated with the contract rules (R10); Start is disabled while the tempo input holds an invalid value.
- Values are not remembered across reloads; every visit starts from the recommended values.
- The builder extracts the admin fields into shared components or wraps them; the behaviour must match.

**Audio and timing (ADR-0016)**

- The `AudioContext` is created or resumed inside the Start click handler (browsers require a user gesture).
- A look-ahead scheduler places clicks on the audio clock. Count-in: 4 clicks, one per quarter note at the chosen tempo, the first one accented. The exercise starts one quarter note after the 4th count-in click, on an accented beat 1; every quarter note clicks, every 4th (beat 1) accented. Clicks are synthesized (short oscillator envelope, a higher pitch for the accent); no audio files.
- The exercise end is `exerciseStart + durationSeconds` on the audio clock. The countdown display is derived from `audioContext.currentTime` (e.g. per animation frame), never from a JS interval counter. Clicks scheduled at or after the end are not played.
- When the end is reached: stop scheduling, close or suspend audio, record `completedAt` (wall clock at that moment) and `localDate` (the browser's local calendar date at that moment), generate `idempotencyKey` (`crypto.randomUUID()`), and go to `saving`.

**Stop and interruption (US-10, US-11a, ADR-0044)**

- **Stop** in `count-in` or `playing` silences audio immediately and returns to `setup`. Nothing is sent to the API.
- The session stops automatically, with nothing logged, when any of these happens during `count-in` or `playing`:
  - `document.visibilityState` becomes `hidden` (tab switch, minimised window, screen lock, app to background);
  - the `AudioContext` leaves the `running` state (e.g. the OS interrupts audio);
  - the page is unloaded (reload, close) or the user navigates away within the app (the component unmounts).
- Losing focus without hiding (e.g. clicking into another window that leaves the tab visible) does **not** stop the session.
- Closing or suspending the `AudioContext` on purpose (after Stop or at completion) is not an interruption and must not change the resulting state.
- Moving from one lesson page to another (`/lessons/A` → `/lessons/B`) counts as leaving: the panel of lesson A is torn down and lesson B starts in `setup`.
- No screen wake lock is requested (ADR-0047).

**Saving (US-11, US-11b, ADR-0042, ADR-0045)**

- One `POST /api/practice-logs` with the payload built at completion. Retries reuse the exact same payload, including `idempotencyKey`.
- The mutation opts out of the global error toast (`meta`); the panel shows the state inline.
- **Retryable:** network failure, `5xx`, `503 SERVICE_UNAVAILABLE`. Automatic retries with backoff (1 s, 2 s, 4 s, … capped at 30 s), with no limit while the page is open. **Retry now** retries immediately.
- **Not retryable:** `400`, `404` → `save-rejected`. `401` → the usual redirect to `/login`, without the leave confirmation below; the unsaved log is lost (ADR-0045).
- While the log is in `saving` or `save-failed`, leaving the page asks for confirmation: the browser's `beforeunload` prompt for reload / close, and a router navigation blocker with a dialog "Your session isn't saved yet. Leave anyway?" for in-app navigation. Leaving anyway drops the unsaved log; nothing is kept for a later resend (ADR-0045).
- On `201` or `200` → `saved`. The lesson queries are not invalidated by this (nothing on the lesson page depends on logs in this scope); the stats queries are invalidated.

### 6.3 Stats `/stats`

**URL is the state.** Search params validated with Zod through TanStack Router, `.default().catch()`:

| Param | Values | Default | | |
| -------- | ----------------------------------------- | -------------------------- | | |
| `tagId` | uuid, optional | none | | |
| `period` | `week` \ | `month` \ | `year` | `week` |
| `date` | `YYYY-MM-DD`, any day inside the period | today (browser local date) | | |

Changing the period keeps `date`, so switching from a week to its month or year works naturally. Paging moves `date` by one period. Refresh, back/forward and shared links restore the same view.

**Layout**

- A toolbar: a single-select tag picker; a ToggleGroup **Week / Month / Year**; a pager "‹ {period label} ›".
  - Period labels: week "Oct 19 – Oct 25, 2026", month "October 2026", year "2026".
  - "›" is disabled when the shown period contains today or lies after it.
- **No tag selected:** in place of the chart, an empty state "Select a tag to see your stats" (shadcn Empty). No request to the stats API.
- **Unknown tag in the URL:** the tag name is resolved with one `GET /api/tags?ids=…` call (ADR-0033). If the API does not return it, `tagId` is removed from the URL (replace), which shows the empty state.
- **Chart** (shadcn `chart` + Recharts `BarChart`), Y axis in minutes:
  - Week → `GET /api/stats/daily` for Monday–Sunday; 7 bars labelled Mon … Sun.
  - Month → `GET /api/stats/daily` for the calendar month; one bar per day, labelled by day of month (sparse ticks are fine).
  - Year → `GET /api/stats/weekly` for 1 January – 31 December; one bar per (clipped) week, X axis ticks at month starts (ADR-0041).
  - Minutes = `seconds / 60`, shown with at most one decimal (`12.5 min`).
  - Tooltip: week/month "Sat, Oct 24 · 25 min"; year "Dec 28 – Dec 31 · 45 min".
  - Days or weeks that lie entirely after today (browser local date) are drawn without a bar and without a `0` in the tooltip; past zero days show a zero-height bar. The API series is used as is; only the "after today" blanking is client-side.
  - No totals, averages or other numbers next to the chart (PRD non-goal).
- **Loading:** a skeleton the size of the chart. **Query error:** the inline Alert with "Try again" (foundation pattern).

**Single-select tag picker.** The existing `TagPicker` is multi-select. The stats screen needs a single-select variant with the same data behaviour (server-side `q`, infinite scroll, names via `ids`, ADR-0033). The trigger shows the selected tag's name or "Select a tag". It lists all tags, including those without logs. The builder decides whether to generalise `TagPicker` or add a sibling component.

## 7. Tests

**API integration tests** (Vitest + Testcontainers, ADR-0018):

- **Create log:** valid input → `201`, row stored with the sent values; the same `idempotencyKey` again (even with a different body) → `200` with the original log and still one row; two concurrent requests with one key → one row; the same key for two different users → two rows; draft lesson → `404`; unknown lesson → `404`; duration 0 / 15 / 45 / 3630, tempo 29 / 301 → `400`; boundary values accepted; `completedAt` 10 minutes in the future → `400`; `localDate` two days off the UTC date of `completedAt` → `400`, one day off → `201`; no session → `401`.
- **Locking interplay:** after a log is created, admin `PUT`, `DELETE` and `unpublish` of that lesson → `409 LESSON_LOCKED` (the lessons-and-tags behaviour, now through the real endpoint).
- **Daily stats:** zero-filled series of the right length and order; a log counts for every tag of its lesson and not for other tags; other users' logs are ignored; bucketing uses `local_date`, shown by a log whose `completed_at` falls on another UTC day; range of 31 days accepted, 32 → `400`; `from > to` → `400`; unknown tag → `404`; tag with no logs → all zeros.
- **Weekly stats:** Monday–Sunday buckets; clipping at both ends (the 2026 example in §5.2); a log on a Sunday and one on the next Monday land in different weeks; range of 366 days accepted, 367 → `400`.
- **Stats performance:** the volume test from §5.3 (a year of 20 logs a day, weekly stats for the year within 200 ms after a warm-up request).

**Contract unit tests:** `PracticeLogInput` (duration and tempo rules, uuid key, date formats); `StatsQuery` (date format, `from <= to`).

**Web unit tests** (Vitest, pure functions only):

- The click schedule: given tempo and duration, the count-in times, the exercise start, which clicks are accented, the end time, and that nothing is scheduled at or after the end.
- Period math for stats: the week (Monday start), month and year ranges for a date, previous / next period, labels, and the "after today" check — including a year whose 1 January is not a Monday and a week crossing a month and a year boundary.

**UI verification** (ADR-0027) through the `local-dev` skill and the Playwright plugin, logged in as `seed@example.com` after `db:seed`:

- lesson page: defaults from the lesson, tempo and duration controls and their limits, Start → count-in → playing → Stop returns to setup with no log; a 30-second session runs to the end and shows "Completed … logged"; stats show it afterwards;
- interruption: hiding the page during play stops it and shows the note; reload during play logs nothing;
- save failure: with the API stopped mid-session (or the request blocked), completion shows the retry state, the leave confirmation appears, and starting the API again saves exactly one log;
- stats: empty state without a tag, tag selection, week / month / year, paging back and forth, "›" disabled on the current period, refresh keeps the view, an unknown `tagId` is dropped from the URL.

The `local-dev` skill's e2e section is updated with these flows.

## 8. Plans

- **`plan-01-backend.md`:** migration, contracts, `POST /api/practice-logs`, both stats endpoints, seed changes, integration and contract tests. Verifiable through tests and `/api/docs`.
- **`plan-02-player-ui.md`:** scheduler and its unit tests, the practice panel on the lesson page, saving with retry and leave guards, header Stats link stub if needed. Verifiable in the browser.
- **`plan-03-stats-ui.md`:** shadcn chart and Recharts, the single-select tag picker, `/stats` with URL state, period math and its unit tests, the Stats header link. Verifiable in the browser against the seed.

Plans 02 and 03 depend on 01 and are independent of each other.

## 9. Decisions recorded with this scope

| ADR                                                                          | Decision                                                                                                  |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [ADR-0040](../../adr/0040-practice-player-without-signature.md)              | Ship the practice player without the signature and without a visual beat (supersedes ADR-0030, tech-debt) |
| [ADR-0041](../../adr/0041-yearly-stats-as-weekly-totals.md)                  | The year stats view shows weekly totals, Monday–Sunday weeks clipped to the year                          |
| [ADR-0042](../../adr/0042-idempotent-practice-log-creation.md)               | Make practice log creation idempotent with a client-generated key                                         |
| [ADR-0043](../../adr/0043-stats-api-date-range-zero-filled-series.md)        | Stats endpoints take a date range and return a zero-filled series in seconds                              |
| [ADR-0044](../../adr/0044-hidden-page-or-interrupted-audio-stops-session.md) | Treat a hidden page or interrupted audio as a stopped session                                             |
| [ADR-0045](../../adr/0045-retry-unsaved-log-only-while-page-open.md)         | Retry an unsaved log only while the page stays open, without an offline buffer (tech-debt)                |
| [ADR-0046](../../adr/0046-recharts-through-shadcn-chart.md)                  | Add Recharts through the shadcn chart component                                                           |
| [ADR-0047](../../adr/0047-desktop-first-no-screen-wake-lock.md)              | Treat the app as desktop-first: no screen wake lock during practice (tech-debt)                           |
| [ADR-0048](../../adr/0048-aggregate-stats-on-read.md)                        | Aggregate stats on read from practice logs, without a snapshot table                                      |

## 10. PRD tracking

When all plans are done, tick US-7, US-8, US-9, US-10, US-11, US-11a, US-11b, US-14 and US-15 with `practice-and-stats` as the delivering scope, and add a note to §5.6 that the year view shows weekly totals (ADR-0041). US-6 stays unticked (rating and signature missing).

## 11. Left to the builder

- Module layout in `apps/api` (e.g. `modules/practice-logs`, `modules/stats`) and `apps/web` (e.g. `features/practice`, `features/stats`).
- The exact SQL text, as long as it follows the shape in §5.3 and is one query per request.
- How the scheduler is structured (class, hook, plain module) and the exact click sound, as long as the accent is clearly distinguishable.
- Whether the admin tempo / duration fields are moved to a shared place or wrapped.
- Whether `TagPicker` gets a single-select mode or a sibling component.
- Chart styling, tick density and exact UI text beyond what §6 quotes.
- The exact distribution of seeded logs, within §4.

## 12. Claude's calls

- The player lives on the lesson page as a page state, not on its own route (agreed in brainstorming; recorded here because the PRD does not say).
- The timer counts down from the chosen duration to `0:00`.
- During count-in the timer shows the full duration and does not run; a "Count-in" label is the only count-in visual.
- The first count-in click is accented, like beat 1.
- After completion, **Practice again** returns to setup with the same tempo and duration.
- Tempo and duration choices are not remembered between visits.
- Stopping in the middle of a session never asks for confirmation (stopping is free; only an unsaved completed log is guarded).
- Week starts on Monday.
- The year view clips weeks to 1 January – 31 December, so a year's weekly bars add up to the same total as its months.
- Stats default to the current week; "›" is disabled from the current period on; days after today are blank, not zero.
- `completedAt` is the client's clock at completion, not the server's receive time, so a log saved after retries keeps its real completion time.
- A repeated idempotency key returns the stored log with `200` even if the body differs; the key, not the body, identifies the session.
- A `404` on save (lesson unpublished during the session) is final; the session is not logged.
- Stats require a selected tag; there is no default tag (agreed in brainstorming).

## Changelog

- 2026-10-25 — `LocalDate` and `completedAt` must be 2000-01-01 or later (found in the plan-01 final review: year `0000` passed validation and failed in Postgres with a `500`). Earlier dates can only come from a broken client.

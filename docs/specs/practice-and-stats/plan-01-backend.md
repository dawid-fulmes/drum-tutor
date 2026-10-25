# Practice and Stats — Plan 01: Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
- **Status:** done

**Goal:** Everything server-side for spec §4, §5 and §7 (API part): the `practice_logs` migration, the contracts, `POST /api/practice-logs` with idempotency and locking, the daily and weekly stats endpoints, the seed with a year of practice, and the integration tests that prove every rule.

**Architecture:** Zod schemas in `packages/contracts` drive validation, types and OpenAPI. `packages/db` gets a migration on `practice_logs` (one hand-edited part: the backfilled key and the `INCLUDE` index, which Drizzle cannot express). `apps/api` gets two modules, `practice-logs` and `stats`, each a route plugin plus a repository returning contract DTOs. Domain failures are thrown as `AppError` and mapped by the existing error handler. Stats are one raw SQL query per request (ADR-0048).

**Tech Stack:** Zod 4, Fastify 5 + fastify-type-provider-zod, Drizzle 0.45 + node-postgres, Vitest 5 + Testcontainers. No new dependencies.

**Spec:** [spec.md](spec.md)

## Global Constraints

- [spec.md](spec.md) wins over this plan if they disagree. Raise the conflict instead of picking one silently.
- **Git:** each task ends with one commit to `main` containing exactly that task's files (the user allowed committing to `main` for the local MVP). Never branch, push, stash, rebase or reset. Commit messages: short imperative summary, no `Co-Authored-By` or any AI attribution.
- Run every `pnpm` command through `scripts/with-node.sh` (e.g. `scripts/with-node.sh pnpm test`).
- No new npm dependencies in this plan.
- Every new route uses `requireUser` (ADR-0035) as a `preHandler` hook, reads the user with `currentUser(request)`, and lists all its response codes with `ApiErrorSchema` for errors, so OpenAPI is complete.
- Every error body follows ADR-0022. Domain errors are thrown as `AppError`; never `reply.send` a hand-built error from a repository.
- A user only ever reads or writes their own logs.
- Durations are seconds everywhere in the API (R10, ADR-0043).
- Code, test data and messages in English. Test emails use `@example.com`.
- Run `scripts/with-node.sh pnpm format` before closing each task.
- Any shortcut or `TODO` needs a tech-debt ADR, and the comment must read `// TODO(ADR-NNNN): …`.

**Exact copy** (validation and error messages):

| Where                                        | Message                                                          |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `LocalDate` malformed or not a calendar date | `Date must be a valid YYYY-MM-DD date`                           |
| `completedAt` malformed / without offset     | `Completion time must be an ISO 8601 date-time with offset`      |
| `localDate` more than 1 day off              | `Local date must be within one day of the completion time`       |
| `completedAt` > server now + 5 min           | `Completion time can't be in the future`                         |
| stats `from` after `to`                      | `Start date must not be after end date`                          |
| daily range > 31 days / weekly > 366 days    | `Range can be at most 31 days` / `Range can be at most 366 days` |
| tempo / duration                             | the existing `LessonInput` messages (reused schemas)             |
| `404 NOT_FOUND`                              | `Lesson not found` / `Tag not found`                             |

## Review Focus

1. **Dates from raw SQL.** node-postgres turns `date` columns into JS `Date` objects in the server's time zone, so a raw stats query can shift every day by one or fail response serialization with a `500`. Every date in a stats response must be the exact `YYYY-MM-DD` string of the bucket. Tested in Task 4 (exact string equality on first/last entries).
2. **`sum()` returns `bigint`.** node-postgres returns it as a string, which fails the response schema with a `500`. `seconds` must be a JSON number. Tested in Task 4 (schema parse of the response plus `typeof`).
3. **Concurrent saves of the same session.** Two `POST`s with one `idempotencyKey` at the same moment must give statuses `[200, 201]` and one row, never a `500` from the unique index. Tested in Task 3.
4. **Impossible calendar dates.** `localDate=2026-02-30`, `from=2026-13-01` must be `400 VALIDATION_ERROR`, never a `500` from a Postgres `date` cast. Tested in Tasks 1 and 4.
5. **A multi-tag lesson.** A log on a lesson with tags A and B counts its full duration once for A and once for B, never twice for A, and never for a tag C the lesson does not have. Tested in Task 4.

---

### Task 1: Contracts for practice logs and stats

**Files:**
- Create: `packages/contracts/src/dates.ts`, `packages/contracts/src/practice-logs.ts`, `packages/contracts/src/stats.ts`
- Modify: `packages/contracts/src/lessons.ts`, `packages/contracts/src/paths.ts`, `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/dates.test.ts`, `packages/contracts/src/practice-logs.test.ts`, `packages/contracts/src/stats.test.ts`

**Interfaces:**
- Produces (all exported from `@drum-tutor/contracts`):
  - `dates.ts`: `LocalDateSchema` (string `YYYY-MM-DD` that is a real calendar date, message from the copy table); `type LocalDate = string`; `daysBetween(from: LocalDate, to: LocalDate): number` (signed whole days, `to − from`, computed on UTC midnights so DST cannot skew it).
  - `lessons.ts`: extract `TempoBpmSchema` and `DurationSecondsSchema` (the current field schemas with their messages, unchanged); `LessonInputSchema` uses them. No behaviour change.
  - `practice-logs.ts`: `PracticeLogInputSchema` = `{ idempotencyKey: z.uuid(), lessonId: z.uuid(), durationSeconds: DurationSecondsSchema, tempoBpm: TempoBpmSchema, completedAt: z.iso.datetime({ offset: true }) (copy-table message), localDate: LocalDateSchema }` with a refinement on path `localDate`: `Math.abs(daysBetween(utcDateOf(completedAt), localDate)) <= 1`, where `utcDateOf` = `new Date(completedAt).toISOString().slice(0, 10)`. `PracticeLogSchema` = `{ id: z.uuid(), lessonId: z.uuid(), durationSeconds: z.number().int(), tempoBpm: z.number().int(), completedAt: z.iso.datetime(), localDate: LocalDateSchema }`. Types `PracticeLogInput` (`z.input`), `PracticeLog`.
  - `stats.ts`: `DailyStatsQuerySchema` and `WeeklyStatsQuerySchema` = `{ tagId: z.uuid(), from: LocalDateSchema, to: LocalDateSchema }` with refinements: `from <= to` (path `from`), inclusive length `daysBetween(from, to) + 1` ≤ 31 / ≤ 366 (path `to`). `DailyStatsSchema` = `{ tagId, from, to, days: { date: LocalDateSchema, seconds: z.number().int().min(0) }[] }`; `WeeklyStatsSchema` = `{ tagId, from, to, weeks: { from: LocalDateSchema, to: LocalDateSchema, seconds: z.number().int().min(0) }[] }`. `STATS_RANGE_DAYS = { daily: 31, weekly: 366 } as const`. Types `StatsQuery`, `DailyStats`, `WeeklyStats`.
  - `ApiPaths` gains `practiceLogs: "/api/practice-logs"`, `statsDaily: "/api/stats/daily"`, `statsWeekly: "/api/stats/weekly"`.

- [x] **Step 1: Write the failing tests**

```ts
// dates.test.ts
it.each(["2026-10-25", "2024-02-29"])("accepts %s", (d) =>
  expect(LocalDateSchema.safeParse(d).success).toBe(true),
);
it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-1-5", "20261025", ""])("rejects %j", (d) =>
  expect(LocalDateSchema.safeParse(d).success).toBe(false),
);
it("counts days across a DST change and a year end", () => {
  expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  expect(daysBetween("2026-01-02", "2026-01-01")).toBe(-1);
});

// practice-logs.test.ts — base: valid uuids, duration 300, tempo 90,
// completedAt "2026-10-25T21:30:00+02:00", localDate "2026-10-25"
it("accepts a valid log", () => expect(ok({})).toBe(true));
it.each([0, 15, 45, 3630])("rejects duration %i", (d) =>
  expect(ok({ durationSeconds: d })).toBe(false),
);
it.each([29, 301])("rejects tempo %i", (t) => expect(ok({ tempoBpm: t })).toBe(false));
it("rejects completedAt without an offset part or malformed", () => {
  expect(ok({ completedAt: "2026-10-25 21:30" })).toBe(false);
});
it("accepts a local date one day off the UTC date (UTC−11 evening, UTC+14 morning)", () => {
  expect(ok({ completedAt: "2026-10-25T23:30:00-11:00", localDate: "2026-10-25" })).toBe(true); // UTC 26th
  expect(ok({ completedAt: "2026-10-26T05:00:00+14:00", localDate: "2026-10-26" })).toBe(true); // UTC 25th
});
it("rejects a local date two days off, on path localDate with the copy-table message", () => {
  const r = PracticeLogInputSchema.safeParse({ ...base, localDate: "2026-10-27" });
  expect(r.error?.issues[0]).toMatchObject({
    path: ["localDate"],
    message: "Local date must be within one day of the completion time",
  });
});

// stats.test.ts
it("accepts from = to and the maximum ranges", () => {
  expect(daily("2026-10-01", "2026-10-31")).toBe(true); // 31 days
  expect(weekly("2024-01-01", "2024-12-31")).toBe(true); // 366 days
});
it("rejects 32 daily days, 367 weekly days and from after to", () => {
  expect(daily("2026-10-01", "2026-11-01")).toBe(false);
  expect(weekly("2024-01-01", "2025-01-01")).toBe(false);
  expect(daily("2026-10-02", "2026-10-01")).toBe(false);
});
```

- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/contracts test`. Expected: FAIL, modules missing.
- [x] **Step 3: Implement the schemas listed under Interfaces.** `LocalDateSchema`: if `z.iso.date()` already rejects `2026-02-30` and `2025-02-29`, use it with the copy message; otherwise add a refinement that round-trips through `Date.UTC`. Keep refinements on `z.object(...)` so Fastify reports them with their path; Task 3 verifies the `details.path` reaches the API response.
- [x] **Step 4: Run** the contracts tests and `scripts/with-node.sh pnpm typecheck` (the `lessons.ts` refactor must not break the web app). Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 2: Migration for idempotency key and stats index

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/migrations/0002_practice_logs_idempotency_and_stats_index.sql` (+ drizzle `meta` files) via `pnpm db:generate`, then hand-edited
- Modify: `apps/api/test/fixtures.ts`
- Test: `apps/api/src/db-constraints.test.ts`

**Interfaces:**
- Produces from `@drum-tutor/db`: `practiceLogs.idempotencyKey` (`uuid("idempotency_key").notNull()`, no default); `NewPracticeLogRow` type.
- Produces in `apps/api/test/fixtures.ts`: `insertPracticeLog(db, lessonId: string, values?: Partial<NewPracticeLogRow>): Promise<PracticeLogRow>` — keeps today's defaults (user `logger@example.com`, 180 s, 60 BPM, now, today) and adds `idempotencyKey: randomUUID()`; any field can be overridden (`userId`, `localDate`, `durationSeconds`, …). Existing callers keep working unchanged. `insertUser(db, email: string): Promise<{ id: string }>` (insert or reuse).

- [x] **Step 1: Write the failing tests** in `db-constraints.test.ts`:
  - two logs of the same user with the same `idempotency_key` → the second insert fails; the same key for two different users → both succeed;
  - a log inserted without `idempotency_key` fails (no default).
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- db-constraints`. Expected: FAIL.
- [x] **Step 3: Change the schema and generate the migration.** In `schema.ts` add the column, `uniqueIndex("practice_logs_user_idempotency_key_idx").on(t.userId, t.idempotencyKey)` and `index("practice_logs_user_local_date_idx").on(t.userId, t.localDate)` with a comment that the migration adds `INCLUDE (lesson_id, duration_seconds)` by hand because Drizzle 0.45 has no `include` (ADR-0048). Run `scripts/with-node.sh pnpm db:generate --name practice_logs_idempotency_and_stats_index`, then edit the SQL:
  - `ADD COLUMN "idempotency_key" uuid DEFAULT gen_random_uuid() NOT NULL;` followed by `ALTER TABLE "practice_logs" ALTER COLUMN "idempotency_key" DROP DEFAULT;` (existing rows get keys, the column ends without a default as the snapshot says);
  - append `INCLUDE ("lesson_id","duration_seconds")` to the `(user_id, local_date)` index.
    Update the fixtures. Then run `scripts/with-node.sh pnpm db:generate` once more: it must report no changes (snapshot and schema agree).
- [x] **Step 4: Run** the test file, then the whole API suite. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 3: `POST /api/practice-logs`

**Files:**
- Create: `apps/api/src/modules/practice-logs/practice-logs.repository.ts`, `apps/api/src/modules/practice-logs/practice-logs.routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/modules/practice-logs/practice-logs.test.ts`

**Interfaces:**
- Consumes: Task 1 `PracticeLogInputSchema`, `PracticeLogSchema`; Task 2 column and fixtures; `AppError`, `hasPgErrorCode`, `PgErrorCode`, `currentUser`.
- Produces:
  - `createPracticeLog(db: Database, userId: string, input: PracticeLogInput, now?: Date): Promise<{ log: PracticeLog; created: boolean }>`.
  - `practiceLogsRoutes: FastifyPluginAsyncZod<{ db: Database }>` with `POST /api/practice-logs` (body `PracticeLogInputSchema`; responses `201`/`200` `PracticeLogSchema`, `400`, `401`, `404` `ApiErrorSchema`), registered in `buildApp`. Replies `201` when `created`, else `200`.

- [x] **Step 1: Write the failing tests** (spec §7 "Create log" and "Locking interplay"); every request logs in with `loginCookies`:
  - valid input on a published lesson → `201`, body equals the input values (`completedAt` normalized to UTC ISO), and exactly one row with the sent `idempotency_key` and `local_date`;
  - same key again with a different `tempoBpm` → `200` with the original log; still one row;
  - two concurrent requests with one new key → statuses sorted `[200, 201]`, one row (Review Focus 3);
  - the same key from two users → two rows, both `201`;
  - draft lesson → `404 Lesson not found`; unknown lesson id → `404`; no row created;
  - duration 0 / 15 / 45 / 3630 and tempo 29 / 301 → `400 VALIDATION_ERROR`; 30 s / 3600 s and 30 / 300 BPM → `201`;
  - `completedAt` 10 minutes ahead of now → `400` with `details` `[{ path: "completedAt", message: "Completion time can't be in the future" }]`; 2 minutes ahead → `201`;
  - `localDate` two days off → `400` with a `details` entry on path `localDate`; one day off → `201`;
  - `localDate: "2026-02-30"` → `400` (Review Focus 4);
  - no cookie → `401`;
  - after a log created through the endpoint: admin `PUT`, `DELETE` and `POST …/unpublish` of that lesson → `409 LESSON_LOCKED`;
  - `GET /api/docs/json` lists `/api/practice-logs`.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- practice-logs`. Expected: FAIL.
- [x] **Step 3: Implement.** Order inside `createPracticeLog`:
  1. Look up the user's log by `(userId, idempotencyKey)`; found → `{ log, created: false }` (no other check runs, spec §5.2).
  2. `completedAt > now + 5 min` → `AppError(400, VALIDATION_ERROR, "Invalid request", [{ path: "completedAt", message: … }])`.
  3. `db.transaction`: `select id, status from lessons where id = $1 for share` (Drizzle `.for("share")`, ADR-0034); missing or `draft` → `404 Lesson not found`. Insert with `.onConflictDoNothing({ target: [userId, idempotencyKey] }).returning()`; no row returned → re-select by key and return `{ created: false }`.
     Map rows to `PracticeLog` in one helper (`completedAt.toISOString()`).
- [x] **Step 4: Run** the practice-log tests and the full API suite. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 4: Daily and weekly stats endpoints

**Files:**
- Create: `apps/api/src/modules/stats/stats.repository.ts`, `apps/api/src/modules/stats/stats.routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/modules/stats/stats.test.ts`, `apps/api/src/modules/stats/stats-performance.test.ts`

**Interfaces:**
- Consumes: Task 1 stats schemas; Task 2 fixtures (`insertPracticeLog` with overrides, `insertUser`); `insertTag`, `insertLesson`.
- Produces:
  - `getDailyStats(db: Database, userId: string, q: StatsQuery): Promise<DailyStats>`, `getWeeklyStats(db: Database, userId: string, q: StatsQuery): Promise<WeeklyStats>`; both throw `404 Tag not found` for an unknown tag.
  - `statsRoutes: FastifyPluginAsyncZod<{ db: Database }>` with `GET /api/stats/daily` (querystring `DailyStatsQuerySchema`) and `GET /api/stats/weekly` (`WeeklyStatsQuerySchema`); responses `200`, `400`, `401`, `404`. Registered in `buildApp`.

- [x] **Step 1: Write the failing tests** `stats.test.ts` (spec §7 "Daily stats", "Weekly stats"). Fixture: user U (logged in), tags A, B, C; lesson L1 with A and B, lesson L2 with A; logs inserted with explicit `userId` and `localDate`:
  - daily `2026-10-01…2026-10-07` returns 7 entries, `days[0].date === "2026-10-01"`, `days[6].date === "2026-10-07"`, zeros on days without logs, every `seconds` a number (Review Focus 1, 2);
  - a 300 s log on L1 counts 300 for A and 300 for B, not 600 for A; tag C → all zeros (Review Focus 5); L1 + L2 on the same day → A gets the sum;
  - another user's log on the same day is ignored;
  - a log with `completed_at` `2026-10-05T23:30:00Z` and `local_date` `2026-10-06` lands on the 6th;
  - 31 days → `200`, 32 → `400`; `from > to` → `400`; `from=2026-13-01` → `400` (Review Focus 4); unknown `tagId` → `404 Tag not found`; no cookie → `401`;
  - weekly `2026-01-01…2026-12-31` → 53 entries; first `{ from: "2026-01-01", to: "2026-01-04" }`, second starts `"2026-01-05"`, last `{ from: "2026-12-28", to: "2026-12-31" }`;
  - a log on Sunday `2026-10-25` and one on Monday `2026-10-26` land in different weeks;
  - weekly 366 days → `200`, 367 → `400`;
  - `GET /api/docs/json` lists both paths.

  `stats-performance.test.ts` (spec §5.3): user P with 20 logs a day (`durationSeconds` 180) for every day of 2025, spread over 3 lessons that each have tag A plus one other tag, and 1,000 logs of another user. Insert in batches of 1,000. One warm-up `GET /api/stats/weekly?tagId=A&from=2025-01-01&to=2025-12-31`, then a measured one: `200`, `sum(seconds) === 365 * 20 * 180`, and duration < 200 ms.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- stats`. Expected: FAIL.
- [x] **Step 3: Implement** per spec §5.3: first `select 1 from tags where id = $tagId` (404 if none), then one `db.execute(sql\`…\`)`. Return every date with `to_char(…, 'YYYY-MM-DD')`(or`::text`) and every sum with `::int`, never a raw `date`or`bigint` column. Weekly shape:

```sql
select to_char(greatest(w, $from::date), 'YYYY-MM-DD') as "from",
       to_char(least(w + 6, $to::date), 'YYYY-MM-DD')   as "to",
       coalesce(s.seconds, 0)::int                       as seconds
from generate_series(date_trunc('week', $from::date::timestamp), $to::date::timestamp, interval '1 week') as g(ts)
cross join lateral (select g.ts::date as w) as wk
left join (
  select date_trunc('week', pl.local_date::timestamp)::date as w, sum(pl.duration_seconds) as seconds
  from practice_logs pl
  join lesson_tags lt on lt.lesson_id = pl.lesson_id and lt.tag_id = $tagId
  where pl.user_id = $userId and pl.local_date between $from::date and $to::date
  group by 1
) s on s.w = wk.w
order by wk.w
```

Daily is the same with `generate_series($from::date::timestamp, $to::date::timestamp, interval '1 day')` and `group by pl.local_date`. Cast dates to `timestamp` (without time zone) before `date_trunc` / `generate_series`: on a bare `date` Postgres picks the `timestamptz` overloads, which depend on the session time zone.
- [x] **Step 4: Run** the stats tests and the full API suite. Expected: PASS.
- [x] **Step 5: Check the plan.** With the performance test's data still in the database (temporarily skip its cleanup or add a one-off `console.log`), run `EXPLAIN (ANALYZE, BUFFERS)` on the weekly query and confirm an index (only) scan on `practice_logs_user_local_date_idx`. Write one line with the result under "Execution notes" at the end of this plan, then remove the temporary code.
- [x] **Step 6: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 5: Seed with a year of practice

**Files:**
- Modify: `packages/db/src/seed.ts`
- Test: `apps/api/src/seed.test.ts`

**Interfaces:**
- Consumes: Task 2 column; Tasks 3–4 endpoints (the test reads through the API).
- Produces: `seedDatabase(db)` unchanged in signature; data per spec §4 "Seed".

- [x] **Step 1: Update the failing test** `seed.test.ts`:
  - exactly **3** locked lessons, all published (was 1); the union of their tags has at least 4 tags; every other published lesson is unlocked;
  - each locked lesson's `createdAt` is more than 13 months ago; every other lesson's `createdAt` is within the last 31 days;
  - as `seed@example.com`, for one tag of a locked lesson: daily stats for the current month and for the same month a year ago both contain non-zero days and at least one zero day; weekly stats for the previous calendar year have a non-zero total;
  - the existing counts (15 published, 18 total, 3 drafts, 6 tags) and the "seeding twice" check still hold.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- seed`. Expected: FAIL.
- [x] **Step 3: Implement.** Replace `LOGGED_LESSON_INDEX` with a list of three published lesson indexes covering at least four tags (the current one included). Those lessons get `created_at` ≈ 14 months ago; the rest keep the 30-day spread. Generate logs for `seed@example.com` from 13 months ago up to yesterday, **deterministically** (no `Math.random`): e.g. practise on 3–5 days of each week chosen by a fixed weekday pattern that rotates per week, with a 3–6 day break every few weeks; 1–2 sessions a practice day on one of the three lessons, duration a multiple of 30 s between 5 and 30 min, tempo near the lesson's recommendation. Each log: `completed_at` at 18:00 UTC on its day, `local_date` = that day, `idempotency_key` = `randomUUID()`. Insert in batches.
- [x] **Step 4: Run** the seed test and the full suite: `scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm typecheck && scripts/with-node.sh pnpm test`. Expected: all PASS.
- [x] **Step 5: Verify against the local app.** `scripts/dev-start.sh`, then `scripts/with-node.sh pnpm db:migrate && scripts/with-node.sh pnpm db:seed`. Log in as `seed@example.com` with `curl -c`, look up a tag id via `GET /api/tags`, and check `curl -b … 'http://localhost:5330/api/stats/weekly?tagId=…&from=<Jan 1 this year>&to=<Dec 31 this year>'` returns 52–53 weeks with non-zero values up to the current week and zeros after. Open `http://localhost:5330/api/docs` and confirm the three new paths render.
- [x] **Step 6: Checkpoint.** `pnpm format`. Tick this plan's checkboxes and set its status to `done`. Commit the task's files to `main`.

## Execution notes

<!-- Filled in during execution: the EXPLAIN result from Task 4, and any decision taken while building. -->

- **Task 4, EXPLAIN (2026-10-25, Testcontainers, 7,300 logs of the busy user + 1,000 of another).** Weekly stats for the busy user's year: 5 ms end to end (budget 200 ms), query 3.2 ms. The planner picks a sequential scan there, correctly, because that user owns 88% of the table. For a user with a small share (another user, one quarter) the plan is a Bitmap Index Scan on `practice_logs_user_local_date_idx` joined through an Index Only Scan on the `lesson_tags` primary key, 1.3 ms. The index is used whenever a user's rows are a small part of the table, which is the real-world case.
- **Task 1.** `LocalDateSchema`'s format regex aborts, and the object refinements in `PracticeLogInputSchema` and the stats queries skip input whose dates are already invalid: Zod 4 runs object refinements even after field checks fail, which threw `RangeError: Invalid time value`.
- **Commits.** No per-task commits were made: the user's global rule requires an explicit ask before any commit, so all plan-01 changes were left uncommitted for the user to commit.
- **Task 5.** The seed rotates the three practised lessons per session (not per day), so each of their tags shows up every week; with per-day rotation the rotation lined up with the weekday pattern and Groove appeared about once a fortnight.
- **Task 5.** The seed test checks the last 28 days up to yesterday and the same window a year earlier, instead of the current month and the same month a year ago: on the first day of a month the current month has no logs yet.
- **Final review.** `LocalDate` and `completedAt` get a lower bound of 2000-01-01 (copy: `Date must be 2000-01-01 or later`, `Completion time must be 2000-01-01 or later`), and `utcMidnight` uses `setUTCFullYear`, because year `0000` passed validation and failed in Postgres with a `500` (spec changelog).
- **Task 4, EXPLAIN addendum (final review).** After `VACUUM ANALYZE` the weekly query is an Index Only Scan on `practice_logs_user_local_date_idx` with `Heap Fetches: 0`; with `ANALYZE` alone the visibility map is not set yet and the planner may choose a bitmap scan.
- **Task 2.** `seed.ts` got `idempotencyKey: randomUUID()` in Task 2, because the new `NOT NULL` column broke the existing seed; the seed itself is rewritten in Task 5.

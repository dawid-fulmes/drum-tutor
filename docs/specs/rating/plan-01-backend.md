# Rating — Plan 01: Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
- **Status:** done

**Goal:** Everything server-side for spec §4, §5, §6 and the API part of §8: the rating contract, the `lesson_ratings` table with the stored aggregate on `lessons`, the locked upsert-and-recompute endpoint, the rating sort as the library default, rating fields on every lesson read, the seed ratings, and the tests that prove each rule.

**Architecture:** `packages/contracts` gets `rating.ts` (value, summary, input, response schemas). `lessons.ts` gains `rating` on `LessonSummary` and splits the detail into a shared `LessonContentSchema`, so `myRating`/`canRate` stay off the admin shapes. `packages/db` gets the table, two columns, an index and `recomputeLessonRating(executor, lessonId)`, the only writer of the aggregate, used by both the API and the seed. `apps/api` reads the aggregate straight from `lessons` (never joins `lesson_ratings` for lists), and `PUT /api/lessons/:id/rating` runs lock → R3 check → upsert → recompute in one transaction.

**Tech Stack:** Zod 4, Fastify 5 + fastify-type-provider-zod, Drizzle 0.45 + node-postgres, Vitest + Testcontainers. No new dependencies.

**Spec:** [spec.md](spec.md)

## Global Constraints

- [spec.md](spec.md) wins over this plan if they disagree. Raise the conflict instead of picking one silently.
- **Git:** never commit, branch, push, stash, rebase or reset unless the user explicitly asked for it in the current turn (user's global rule). Each task's "Checkpoint" lists the files that belong together, so the user can commit them per task when they choose. If asked to commit: to `main`, short imperative summary, no `Co-Authored-By` or AI attribution.
- Run every `pnpm` command through `scripts/with-node.sh`. Run typecheck as `pnpm typecheck --force` (turbo's typecheck cache ignores dependency changes, signature plan-01 Execution notes).
- No new npm dependencies.
- `packages/db` does not import `@drum-tutor/contracts` (`schema.ts`, signature spec §4.1).
- `lessons.rating_count` / `lessons.rating_avg` are written only by `recomputeLessonRating` (ADR-0055). The library and admin list queries never join or aggregate `lesson_ratings`.
- Every error body follows ADR-0022. Domain errors are thrown as `AppError` from repositories.
- Code, test data and messages in English. Test emails use `@example.com`.
- Run `scripts/with-node.sh pnpm format` before closing each task.
- Any shortcut or `TODO` needs a tech-debt ADR, and the comment must read `// TODO(ADR-NNNN): …`.

**Exact copy**

| Where                                  | Message                                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `RatingValueSchema` (any violation)    | `Choose a rating from 1 to 5`                                                                          |
| `409 RATING_REQUIRES_COMPLETION`       | `Complete this lesson once before rating it`                                                           |
| `404` on rating a draft/missing lesson | `Lesson not found` (existing copy)                                                                     |
| rating route summary                   | `Rate a lesson you have completed (1–5); writing again replaces the rating`                            |
| library route summary                  | `Browse published lessons, filtered by tags (all) and difficulties (any), sorted by rating by default` |

## Review Focus

1. **Concurrent first ratings of one lesson by many users.** Without the `FOR UPDATE` on the lesson taken first, two recomputes read snapshots that miss each other and the count drifts low. Expected: `rating_count` equals the number of rows. Tested in Task 3 with 20 parallel `PUT`s, repeated 5 times.
2. **One user double-submitting two values at once** (double click, two tabs). Expected: one row, no `500` from the primary key, the aggregate matches the surviving value. Tested in Task 3.
3. **A rating sent while the user's very first log is still being saved.** The log insert holds `FOR SHARE` on the lesson and the rating takes `FOR UPDATE`, so the rating waits and then sees the committed log, or runs first and gets `409`. Never a deadlock or `500`. Tested in Task 3 by firing the log `POST` and the rating `PUT` together 10 times and accepting `200` or `409` only, with the aggregate consistent after each pair.
4. **Pagination across the rated/unrated boundary and through average ties.** With `pageSize=2` over 5 lessons (two tied averages, two unrated), concatenating every page yields each lesson exactly once in rule-7 order. Tested in Task 2.
5. **A library URL with no `sort` or with `sort=rating` plus filters.** Both use the rating order; difficulty and tag filters still apply and `totalItems` counts only the filtered set. Tested in Task 2.

---

### Task 1: Rating contract

**Files:**

- Create: `packages/contracts/src/rating.ts`
- Modify: `packages/contracts/src/lessons.ts`, `packages/contracts/src/api-error.ts`, `packages/contracts/src/paths.ts`, `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/rating.test.ts`, `packages/contracts/src/lessons.test.ts`

**Interfaces:**

- Produces (exported from `@drum-tutor/contracts`):
  - `RATING = { min: 1, max: 5 } as const`.
  - `RatingValueSchema = z.number(msg).int(msg).min(1, msg).max(5, msg)`, `type RatingValue = number`. `msg` is the copy-table text.
  - `RatingSummarySchema = z.object({ average: z.number().min(1).max(5).nullable(), count: z.number().int().min(0) })`, `type RatingSummary`.
  - `RateLessonInputSchema = z.object({ rating: RatingValueSchema })`, `type RateLessonInput`.
  - `LessonRatingSchema = z.object({ rating: RatingSummarySchema, myRating: RatingValueSchema })`, `type LessonRating`.
  - `LessonSortSchema = z.enum(["rating", "newest", "oldest"])`. `LibraryQuerySchema.sort` defaults to `"rating"`.
  - `LessonSummarySchema` gains `rating: RatingSummarySchema`.
  - `LessonContentSchema = LessonSummarySchema.extend({ description, signature })`, `type LessonContent`. `LessonDetailSchema = LessonContentSchema.extend({ myRating: RatingValueSchema.nullable(), canRate: z.boolean() })`. `AdminLessonSchema = LessonContentSchema.extend(adminFields)`. `AdminLessonSummarySchema` is unchanged in code (it inherits `rating`).
  - `ApiErrorCode.RATING_REQUIRES_COMPLETION = "RATING_REQUIRES_COMPLETION"`.
  - `ApiPaths.lessonRating = "/api/lessons/:id/rating"`.

- [x] **Step 1: Write the failing tests.**
  - `rating.test.ts`: `RatingValueSchema` accepts `1` and `5`; rejects `0`, `6`, `3.5` and `"4"`, each with the message `Choose a rating from 1 to 5`. `RatingSummarySchema` accepts `{ average: null, count: 0 }` and `{ average: 4.33, count: 3 }`, rejects `{ average: 0.5, count: 1 }` and `{ average: 4, count: -1 }`. `RateLessonInputSchema` rejects `{}`. `LessonRatingSchema` rejects `myRating: null`.
  - `lessons.test.ts`: change the existing `defaults filters and sort` expectation to `sort: "rating"`; `LibraryQuerySchema` accepts `sort: "newest"`, `"oldest"`, `"rating"` and rejects `"best"`. `AdminLessonSchema.shape` has no `myRating` or `canRate` key; `LessonDetailSchema.shape` has both; both have `rating`.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/contracts test`. Expected: FAIL.
- [x] **Step 3: Implement** the Interfaces above. Export `rating.ts` from `index.ts`.
- [x] **Step 4: Run** the contracts tests (PASS) and `scripts/with-node.sh pnpm typecheck --force`. Expected: `contracts` and `web` PASS (no web code builds these objects). `api` fails only where mappers miss `rating`/`myRating`/`canRate` (fixed in Task 2).
- [x] **Step 5: Checkpoint.** `pnpm format`. Files of this task: the contracts files above.

### Task 2: Schema, migration, aggregate recompute and rating on every read

**Files:**

- Modify: `packages/db/src/schema.ts`, `packages/db/src/index.ts`
- Create: `packages/db/src/ratings.ts`, `packages/db/migrations/0004_lesson_ratings.sql` (+ drizzle `meta` snapshot and journal entry)
- Modify: `apps/api/src/modules/lessons/lesson-tags.ts`, `apps/api/src/modules/lessons/library.repository.ts`, `apps/api/src/modules/lessons/lessons.routes.ts`, `apps/api/src/modules/lessons/admin-lessons.repository.ts`, `apps/api/test/helpers.ts`, `apps/api/test/fixtures.ts`
- Test: `apps/api/src/modules/lessons/library.test.ts`, `apps/api/src/modules/lessons/admin-lessons.test.ts`

**Interfaces:**

- Consumes: Task 1 schemas and types.
- Produces:
  - `schema.ts`: `lessons.ratingCount = integer("rating_count").notNull().default(0)`, `lessons.ratingAvg = numeric("rating_avg", { precision: 3, scale: 2 })` (string | null in Drizzle); checks `lessons_rating_avg_matches_count` (`(rating_count = 0) = (rating_avg is null)`) and `lessons_rating_avg_range` (`rating_avg between 1 and 5`); index `lessons_status_rating_idx` on `(status, rating_avg desc nulls last, rating_count desc, created_at desc, id desc)` (Drizzle `.desc().nullsLast()` per column).
  - `schema.ts`: `lessonRatings = pgTable("lesson_ratings", { lessonId → lessons.id onDelete "restrict", userId → users.id onDelete "cascade", rating: smallint().notNull(), createdAt, updatedAt: timestamptz not null default now() })`, primary key `(lessonId, userId)`, check `lesson_ratings_rating_range` (`rating between 1 and 5`). Types `LessonRatingRow`, `NewLessonRatingRow`. A comment on the table points to ADR-0055 and states that R3 is checked by the API, not the database.
  - `packages/db/src/ratings.ts`: `type DbExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0]` (local, not exported from the package root to avoid clashing with the API's own) and `recomputeLessonRating(db: DbExecutor, lessonId: string): Promise<{ ratingCount: number; ratingAvg: string | null }>` (the returned columns, so the API's `toRatingSummary` takes it as is), the spec §5.2 statement as one Drizzle `update(lessons).set({ ratingCount: sql\`(select count(*)::int …)\`, ratingAvg: sql\`(select round(avg(rating), 2) …)\` }).where(eq(lessons.id, lessonId)).returning(…)`. Doc comment: the only writer of the aggregate; callers that may race must lock the lesson row first (ADR-0055). Exported from `index.ts`.
  - `lesson-tags.ts`: `toRatingSummary(row: Pick<LessonRow, "ratingCount" | "ratingAvg">): RatingSummary` (`average: row.ratingAvg === null ? null : Number(row.ratingAvg)`), used by `toLessonSummary`, which now adds `rating`.
  - `library.repository.ts`: `getPublishedLesson(db, id, userId)` returns `LessonDetail` with `myRating` (primary-key lookup in `lesson_ratings`) and `canRate` (`exists` on `practice_logs` for user and lesson). `listLibrary` orders by `lessons.ratingAvg desc nulls last, ratingCount desc, createdAt desc, id desc` when `q.sort === "rating"`.
  - `helpers.ts`: `resetDatabase` truncates `lesson_ratings` too.
  - `fixtures.ts`: `insertRating(db, { lessonId, userId, rating }): Promise<void>` inserts the row and calls `recomputeLessonRating` (for tests that need rated lessons without going through the endpoint).

- [x] **Step 1: Write the failing tests.**
  - `library.test.ts`, new `describe("rating")`:
    - a lesson with no ratings lists `rating: { average: null, count: 0 }`;
    - after `insertRating` 5, 4, 4 from three users, the list item and the detail carry `{ average: 4.33, count: 3 }`;
    - **order** (Review Focus 4): lessons `A` avg 4.5 (2 ratings), `B` avg 4.5 (4 ratings), `C` avg 5 (1 rating), `D` unrated older, `E` unrated newer → `?sort=rating` names `["C", "B", "A", "E", "D"]`; the same with no `sort` param; `pageSize=2` pages 1–3 concatenated equal that list and `totalItems` is 5;
    - equal average and count fall back to `created_at desc` then `id desc` (two lessons with identical ratings and identical `createdAt`: ids descending);
    - **filters** (Review Focus 5): `?difficulties=advanced` with the rating sort lists only advanced lessons in rule-7 order and `totalItems` counts only them; `?tagIds=<a>` likewise;
    - `?sort=newest` and `?sort=oldest` still order by `created_at` (existing tests unchanged);
    - detail: user without a log → `canRate: false, myRating: null`; with a log of **another** lesson only → `canRate: false`; with a log of this lesson → `canRate: true, myRating: null`; with a log and an inserted rating 3 → `myRating: 3`; another user's rating does not show up as `myRating`;
    - the list items have no `myRating` or `canRate` key.
  - `admin-lessons.test.ts`: the admin list item and the admin detail carry `rating` equal to the inserted ratings' summary; the admin detail has no `myRating`/`canRate` key. Update existing exact-shape expectations for the added `rating` field.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- lessons`. Expected: FAIL.
- [x] **Step 3: Add the table, columns and migration.** Edit `schema.ts`, run `scripts/with-node.sh pnpm --filter @drum-tutor/db generate --name lesson_ratings`, check the generated SQL creates the table, the checks, both columns with `rating_count` default `0`, and the index with `DESC NULLS LAST` on `rating_avg`. Add a header comment: `-- Ratings and the stored aggregate on lessons (ADR-0055, spec §5).` Then add `ratings.ts`.
- [x] **Step 4: Implement the reads.** `toLessonSummary` adds `rating`. `listLibrary` switches on `q.sort` (`rating` / `newest` / `oldest`). `getPublishedLesson` takes `userId` and adds `myRating`, `canRate`; `lessons.routes.ts` passes `currentUser(request).id`. Admin mappers get `rating` through `toLessonSummary` and keep building `AdminLesson` from the content fields only. Update the library route summary to the copy-table text.
- [x] **Step 5: Run** `scripts/with-node.sh pnpm typecheck --force` and the full API suite. Expected: PASS.
- [x] **Step 6: Checkpoint.** `pnpm format`. Files of this task: the files above.

### Task 3: `PUT /api/lessons/:id/rating`

**Files:**

- Create: `apps/api/src/modules/lessons/rating.repository.ts`
- Modify: `apps/api/src/modules/lessons/lessons.routes.ts`
- Test: `apps/api/src/modules/lessons/rating.test.ts`

**Interfaces:**

- Consumes: Task 1 `RateLessonInputSchema`, `LessonRatingSchema`, `ApiErrorCode.RATING_REQUIRES_COMPLETION`, `ApiPaths.lessonRating`; Task 2 `lessonRatings`, `recomputeLessonRating`, `toRatingSummary`.
- Produces: `rateLesson(db: Database, userId: string, lessonId: string, rating: number): Promise<LessonRating>` in `rating.repository.ts`. The route `PUT ApiPaths.lessonRating` (tag `lessons`, `params: IdParamsSchema`, `body: RateLessonInputSchema`, responses `200: LessonRatingSchema`, `400`, `401`, `404`, `409: ApiErrorSchema`).

`rateLesson` runs in one `db.transaction`, in this order (spec §6.3):

1. `select({ id }) from lessons where id = $1 and status = 'published'` with `.for("update")`; none → `AppError(404, NOT_FOUND, "Lesson not found")`.
2. `select 1 from practice_logs where user_id and lesson_id limit 1`; none → `AppError(409, RATING_REQUIRES_COMPLETION, copy)`.
3. `insert(lessonRatings).values(…).onConflictDoUpdate({ target: [lessonId, userId], set: { rating, updatedAt: sql\`now()\` } })`.
4. `recomputeLessonRating(tx, lessonId)` → respond `{ rating: toRatingSummary(…), myRating: rating }`.

- [x] **Step 1: Write the failing tests** (`rating.test.ts`, same setup as `library.test.ts`; a `consistent(lessonId)` helper asserts the lesson row's `rating_count`/`rating_avg` equal `count(*)`/`round(avg(rating), 2)` over `lesson_ratings`, read with raw SQL; call it after every write case):
  - no log → `409`, `error.code === "RATING_REQUIRES_COMPLETION"`, copy-table message; no row in `lesson_ratings`; lesson `rating_count` still `0`;
  - with a log → `200` body `{ rating: { average: 4, count: 1 }, myRating: 4 }`; `GET` detail shows `myRating: 4`, `canRate: true`, the same `rating`;
  - again with `2` → `200`, `{ average: 2, count: 1 }`, one row, `updated_at` later than `created_at`;
  - same value again → `200`, unchanged summary;
  - three users rate 5, 4, 4 → last response `{ average: 4.33, count: 3 }`;
  - draft lesson (with a log inserted directly) → `404`; unknown id → `404`; malformed id → `400`; body `{ rating: 6 }`, `{ rating: 3.5 }`, `{}` → `400 VALIDATION_ERROR` with a `rating` detail path; no session → `401`;
  - there is no `DELETE` route: `DELETE` on the path → `404` (Fastify's not-found handler in ADR-0022 shape);
  - **concurrency** (Review Focus 1): 20 users each with a log, `Promise.all` of 20 `PUT`s with ratings `1 + (i % 5)` → all `200`; `rating_count = 20`, `consistent()`; repeat 5 times on fresh lessons;
  - **double submit** (Review Focus 2): one user, `Promise.all([PUT 2, PUT 5])` → both `200`, one row whose rating is 2 or 5, `consistent()`; repeat 10 times;
  - **first log racing the rating** (Review Focus 3): a fresh user with no log; `Promise.all([POST practice log, PUT rating 4])` → log `201`, rating `200` or `409`, never `500`; `consistent()`; repeat 10 times with fresh users;
  - the OpenAPI document lists `put` on `/api/lessons/{id}/rating` with `409` among its responses.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- rating`. Expected: FAIL.
- [x] **Step 3: Implement** `rateLesson` and the route (summary from the copy table, `currentUser(request).id`).
- [x] **Step 4: Run** the full API suite. Expected: PASS, including the 5× and 10× loops.
- [x] **Step 5: Checkpoint.** `pnpm format`. Files of this task: the files above.

### Task 4: Seed ratings

**Files:**

- Modify: `packages/db/src/seed.ts`
- Test: `apps/api/src/seed.test.ts`
- Modify (docs): this plan (status, checkboxes, Execution notes), `docs/specs/README.md` (rating row: `plan-01-backend.md (done)`)

**Interfaces:**

- Consumes: Task 2 `lessonRatings`, `recomputeLessonRating`; Task 2–3 reads (the test goes through the API).
- Produces: `seedDatabase(db)` unchanged in signature. Six rater users `rater1@example.com` … `rater6@example.com`, upserted like the seed user. A `RATINGS` table in `seed.ts` keyed by lesson index (signature spec §5.1 numbering):

| #   | Lesson                    | Seed user | Raters 1–6  | Average | Count |
| --- | ------------------------- | --------- | ----------- | ------- | ----- |
| 4   | Four on the floor         | —         | 5 5 4 5 4 5 | 4.67    | 6     |
| 1   | Money beat                | 5         | 4 5 5 4     | 4.60    | 5     |
| 0   | Single strokes on a pad   | —         | 4 5 4 5 4 5 | 4.50    | 6     |
| 6   | Double strokes            | —         | 5 4         | 4.50    | 2     |
| 2   | Single paradiddles        | 4         | 4 3 5       | 4.00    | 4     |
| 8   | Disco offbeat hi-hat      | —         | 4           | 4.00    | 1     |
| 5   | Weak hand eighth notes    | —         | 3 4 3       | 3.33    | 3     |
| 3   | Quarter-note kick control | —         | 2 3         | 2.50    | 2     |

Rater _k_ gives the _k_-th value in the row. Every rater gets one practice log (180 s, the lesson's recommended tempo, completed yesterday at 17:00 UTC, `local_date` yesterday) on each lesson they rate, before the rating is written (R3). The seed user already has logs on 1, 2 and 5 and rates only 1 and 2.

- [x] **Step 1: Update the failing test** `seed.test.ts`, inside `check()`:
  - locked lessons are now the eight lessons of the table; the `createdAt` rule becomes: the seed user's lessons (Money beat, Single paradiddles, Weak hand eighth notes) older than 13 months, every other lesson newer than 31 days;
  - `GET /api/lessons?pageSize=100` (default sort): the first eight names are, in order, `Four on the floor`, `Money beat`, `Single strokes on a pad`, `Double strokes`, `Single paradiddles`, `Disco offbeat hi-hat`, `Weak hand eighth notes`, `Quarter-note kick control`, with the averages and counts of the table; the remaining seven have `{ average: null, count: 0 }` and are in `createdAt` descending order;
  - as `seed@example.com`: Money beat `myRating 5, canRate true`; Single paradiddles `myRating 4`; Weak hand eighth notes `myRating null, canRate true`; Four on the floor `myRating null, canRate false`;
  - raw SQL: every `lesson_ratings` row has a `practice_logs` row with the same user and lesson (R3 in the seed data); every lesson's `rating_count`/`rating_avg` equal the recompute;
  - the existing checks (counts, tags, signatures, seed-user stats) still pass;
  - running `seedDatabase` twice gives the same result (already covered by the existing `it`).
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- seed`. Expected: FAIL.
- [x] **Step 3: Implement.** Delete `lesson_ratings` first in `seedDatabase`. After the seed user's logs: upsert the raters, insert their logs, insert all ratings from `RATINGS`, then `recomputeLessonRating(tx, id)` for every rated lesson. Keep `LOGGED_LESSON_INDEXES` and the history generator as they are.
- [x] **Step 4: Run** `scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm typecheck --force && scripts/with-node.sh pnpm test`. Expected: all PASS.
- [x] **Step 5: Verify against the local app.** Start the stack with the `local-dev` skill, then `scripts/with-node.sh pnpm db:migrate && scripts/with-node.sh pnpm db:seed`. Log in with `curl -c` as `seed@example.com`, then:
  - `GET /api/lessons?pageSize=3` lists Four on the floor, Money beat, Single strokes on a pad with their `rating`;
  - `GET /api/lessons/<Weak hand eighth notes id>` has `canRate: true, myRating: null`;
  - `PUT /api/lessons/<Weak hand eighth notes id>/rating` with `{"rating":5}` → `200` with `{ average: 3.75, count: 4 }`;
  - `PUT` on Four on the floor → `409 RATING_REQUIRES_COMPLETION`;
  - `/api/docs` shows the `PUT` route, `rating` on the lesson schemas and `sort` with `rating` as default.
  - Re-run `db:seed` afterwards to restore the seed state.
- [x] **Step 6: Checkpoint.** `pnpm format`. Tick this plan's checkboxes, set its status to `done`, update the rating row in `docs/specs/README.md`. Files of this task: the files above.

## Execution notes

<!-- Filled in during execution: any decision taken while building. -->

- **Commits.** None made: the user's global rule requires an explicit ask before any commit, so all plan-01 changes are left uncommitted for the user.
- **Task 2.** Drizzle emits `NULLS LAST` on every `DESC` column of `lessons_status_rating_idx`, so the library `ORDER BY` uses `desc nulls last` on all four keys to match it (same row order, since the other three keys are `NOT NULL`; EXPLAIN shows a plain index scan). `canRate` is a `limit 1` select on `practice_logs`, served by the existing `(user_id, local_date) INCLUDE (lesson_id)` index; no new index.
- **Task 3.** The naive "first log racing the rating" test always lands on `409` (the log `POST` reads by idempotency key before its transaction), so a deterministic test holds the log's `FOR SHARE` until the rating waits on the lock and then expects `200`. Removing the `FOR UPDATE` makes the 20-user test drift (5, 8, 12 instead of 20).
- **Focused test runs.** `pnpm --filter … test -- <name>` runs the whole suite; `pnpm --filter @drum-tutor/api exec vitest run <name>` filters.
- **Task 4, local check (2026-10-26).** After `db:migrate` and `db:seed`: the library starts with Four on the floor, Money beat, Single strokes on a pad; Weak hand eighth notes has `canRate: true, myRating: null`; rating it 5 returns `{ average: 3.75, count: 4 }`; rating Four on the floor returns `409 RATING_REQUIRES_COMPLETION`; OpenAPI lists the `PUT` route and `sort` defaulting to `rating`. Reseeded afterwards.

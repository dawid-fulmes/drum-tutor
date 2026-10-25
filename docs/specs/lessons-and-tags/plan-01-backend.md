# Lessons and Tags — Plan 01: Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
- **Status:** done

**Goal:** Everything server-side for spec §4, §5 and §7: the migration, the contracts, the tag and lesson endpoints with locking, the seed and `pnpm db:seed`, and the integration tests that prove every rule.

**Architecture:** Zod schemas in `packages/contracts` drive validation, types and OpenAPI. `packages/db` gets the new tables and a `seedDatabase` function. `apps/api` gets two modules, `tags` and `lessons`, each split into route plugins (drummer / admin) and repositories that return contract DTOs. Domain failures are thrown as `AppError` and mapped by the existing error handler, so routes stay thin.

**Tech Stack:** as in the foundation: Zod 4, Fastify 5 + fastify-type-provider-zod, Drizzle 0.45 + node-postgres, Vitest 5 + Testcontainers. No new dependencies.

**Spec:** [spec.md](spec.md)

## Global Constraints

- [spec.md](spec.md) wins over this plan if they disagree. Raise the conflict instead of picking one silently.
- **Git:** each task ends with one commit to `main` containing exactly that task's files (the user allowed committing to `main` for the local MVP on 2026-10-25). Never branch, push, stash, rebase or reset. Commit messages: short imperative summary, no `Co-Authored-By` or any AI attribution.
- Run every `pnpm` command through `scripts/with-node.sh` (e.g. `scripts/with-node.sh pnpm test`).
- No new npm dependencies in this plan.
- Every new route uses `requireUser` (ADR-0035) and lists all its response codes with `ApiErrorSchema` for errors, so OpenAPI is complete.
- Every error body follows ADR-0022. Domain errors are thrown as `AppError` (Task 3); never `reply.send` a hand-built error from a repository.
- Each list endpoint = one page query + one count query + at most one batched tags query for the page. No per-row queries.
- Code, test data and messages in English. Test emails use `@example.com`.
- Run `scripts/with-node.sh pnpm format` before closing each task.
- Any shortcut or `TODO` needs a tech-debt ADR, and the comment must read `// TODO(ADR-NNNN): …`.

**Exact copy** (validation and error messages, used by API and UI alike):

| Where                              | Message                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| tag name empty / too long          | `Tag name is required` / `Tag name can be at most 50 characters`                                    |
| lesson name empty / too long       | `Name is required` / `Name can be at most 120 characters`                                           |
| description empty / too long       | `Description is required` / `Description can be at most 5000 characters`                            |
| difficulty missing or invalid      | `Choose a difficulty`                                                                               |
| tagIds empty / > 10 / duplicates   | `Choose at least one tag` / `A lesson can have at most 10 tags` / `A tag can only be selected once` |
| tempo out of range / not integer   | `Tempo must be between 30 and 300 BPM`                                                              |
| duration out of range              | `Duration must be between 0:30 and 60:00`                                                           |
| duration not a 30 s step           | `Duration must be in 30-second steps`                                                               |
| `409 TAG_NAME_TAKEN`               | `A tag named "<normalized name>" already exists`                                                    |
| `409 TAG_IN_USE`                   | `This tag is used by lessons and can't be deleted`                                                  |
| `409 LESSON_LOCKED`                | `This lesson has practice logs and can't be changed`                                                |
| `404 NOT_FOUND`                    | `Lesson not found` / `Tag not found`                                                                |
| `400 VALIDATION_ERROR` unknown tag | message `Invalid request`, detail `{ path: "tagIds", message: "Unknown tag: <id>" }` per unknown id |

## Review Focus

1. **Array query params in every form.** `tagIds=a`, `tagIds=a&tagIds=b`, `tagIds=a&tagIds=a` and `tagIds=garbage` must give a one-element filter, a two-element filter, a deduplicated filter and `400` respectively — never `500`. Tested in Task 5.
2. **Concurrent duplicate tag creates.** `"Groove"` and `"groove"` posted at the same time must give one `201` and one `409 TAG_NAME_TAKEN`, never `500` from the unique index. Tested in Task 3.
3. **LIKE metacharacters in tag search.** `q=%`, `q=_` and `q=\` must match those characters literally, not everything. Tested in Task 3.
4. **Malformed ids in paths.** `/api/admin/lessons/not-a-uuid` (and every other `:id` route) must return `400` in `ApiError` shape, never `500` from a Postgres uuid cast. Tested in Tasks 3–5.
5. **Repeated tag in a lesson body.** `tagIds: [a, a]` must return `400` with `A tag can only be selected once`, never `500` from the `lesson_tags` primary key. Tested in Task 4.

---

### Task 1: Contracts for pagination, tags and lessons

**Files:**
- Create: `packages/contracts/src/pagination.ts`, `packages/contracts/src/tags.ts`, `packages/contracts/src/lessons.ts`
- Modify: `packages/contracts/src/api-error.ts`, `packages/contracts/src/paths.ts`, `packages/contracts/src/index.ts`
- Test: `packages/contracts/src/tags.test.ts`, `packages/contracts/src/lessons.test.ts`, `packages/contracts/src/pagination.test.ts`

**Interfaces:**
- Produces (all exported from `@drum-tutor/contracts`):
  - `pagination.ts`: `PaginationQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) })`, `type PaginationQuery = z.output<…>`. `pageSchema<T extends z.ZodType>(item: T)` → `z.object({ items: z.array(item), page, pageSize, totalItems, totalPages })` (all non-negative ints), `type Page<T>`. `queryArray<T extends z.ZodType>(item: T, max: number)` → accepts one value or an array (Fastify gives a string for a single key, an array for repeated keys), outputs a deduplicated array, rejects more than `max` items, optional (absent → `[]`). `IdParamsSchema = z.object({ id: z.uuid() })`.
  - `tags.ts`: `TagNameSchema` (trim → collapse `\s+` to one space → 1–50 chars, messages from the copy table), `TagInputSchema = z.object({ name: TagNameSchema })`, `TagSchema = z.object({ id: z.uuid(), name: z.string() })`, `AdminTagSchema = TagSchema.extend({ lessonCount: z.number().int().min(0) })`, `TagListQuerySchema = PaginationQuerySchema.extend({ q: z.string().trim().max(50).optional(), ids: queryArray(z.uuid(), 100) })`. Types `Tag`, `AdminTag`, `TagInput`, `TagListQuery`.
  - `lessons.ts`: `DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const`, `DifficultySchema` (`z.enum(DIFFICULTIES, { error: "Choose a difficulty" })`), `LessonStatusSchema` (`draft`, `published`), `LessonSortSchema` (`newest`, `oldest`). `TEMPO_BPM = { min: 30, max: 300 } as const`, `DURATION_SECONDS = { min: 30, max: 3600, step: 30 } as const`. `LessonInputSchema` per spec §5.1 (`name`, `description` trimmed; `tagIds` 1–10, duplicates rejected — not deduplicated). `LessonSummarySchema`, `LessonDetailSchema`, `AdminLessonSummarySchema`, `AdminLessonSchema` per spec §5.1. `LibraryQuerySchema = PaginationQuerySchema.extend({ tagIds: queryArray(z.uuid(), 20), difficulties: queryArray(DifficultySchema, 3), sort: LessonSortSchema.default("newest") })`. Types for each.
  - `ApiErrorCode` gains `TAG_NAME_TAKEN`, `TAG_IN_USE`, `LESSON_LOCKED`.
  - `ApiPaths` gains `tags: "/api/tags"`, `lessons: "/api/lessons"`, `lesson: "/api/lessons/:id"`, `adminTags: "/api/admin/tags"`, `adminTag: "/api/admin/tags/:id"`, `adminLessons: "/api/admin/lessons"`, `adminLesson: "/api/admin/lessons/:id"`, `adminLessonPublish: "/api/admin/lessons/:id/publish"`, `adminLessonUnpublish: "/api/admin/lessons/:id/unpublish"`, plus `withId(path: string, id: string): string` replacing `:id`.

- [x] **Step 1: Write the failing tests**

```ts
// tags.test.ts
it("normalizes whitespace and keeps casing", () => {
  expect(TagNameSchema.parse("  Weak   hand ")).toBe("Weak hand");
});
it.each(["", "   ", "a".repeat(51)])("rejects %j", (v) =>
  expect(TagNameSchema.safeParse(v).success).toBe(false),
);
it("accepts 50 chars", () => expect(TagNameSchema.parse("a".repeat(50))).toHaveLength(50));

// lessons.test.ts — base = a valid LessonInput with one uuid tag, tempo 60, duration 180
it.each([30, 300])("accepts tempo %i", (t) => expect(ok({ recommendedTempoBpm: t })).toBe(true));
it.each([29, 301, 60.5])("rejects tempo %s", (t) =>
  expect(ok({ recommendedTempoBpm: t })).toBe(false),
);
it.each([30, 3600])("accepts duration %i", (d) =>
  expect(ok({ recommendedDurationSeconds: d })).toBe(true),
);
it.each([0, 15, 45, 3630])("rejects duration %i", (d) =>
  expect(ok({ recommendedDurationSeconds: d })).toBe(false),
);
it("rejects no tags, 11 tags and a repeated tag", () => {
  /* three asserts, repeated tag message "A tag can only be selected once" */
});
it("rejects an empty difficulty with 'Choose a difficulty'", () => {
  /* … */
});
it("trims name and description and rejects blank ones", () => {
  /* … */
});

// pagination.test.ts
it("coerces page and pageSize from strings with defaults 1 and 20", () => {
  expect(PaginationQuerySchema.parse({ page: "3", pageSize: "12" })).toEqual({
    page: 3,
    pageSize: 12,
  });
  expect(PaginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
});
it.each([{ page: "0" }, { pageSize: "0" }, { pageSize: "101" }, { page: "1.5" }])(
  "rejects %j",
  (q) => expect(PaginationQuerySchema.safeParse(q).success).toBe(false),
);
it("queryArray accepts a single value, an array, dedupes, and caps", () => {
  const s = z.object({ ids: queryArray(z.uuid(), 2) });
  expect(s.parse({ ids: A }).ids).toEqual([A]);
  expect(s.parse({ ids: [A, A, B] }).ids).toEqual([A, B]);
  expect(s.parse({}).ids).toEqual([]);
  expect(s.safeParse({ ids: [A, B, C] }).success).toBe(false);
});
it("withId fills the id", () => expect(withId(ApiPaths.lesson, "x")).toBe("/api/lessons/x"));
```

- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/contracts test`. Expected: FAIL, modules missing.
- [x] **Step 3: Implement the schemas listed under Interfaces.** `queryArray` caps on the raw input (before dedupe) so a huge query is rejected cheaply. Keep schemas OpenAPI-friendly: `z.union([item, z.array(item)])` followed by `.transform`, with `.optional()` / default on the outside; Task 3 verifies `/api/docs/json` still builds.
- [x] **Step 4: Run** the contracts tests and `scripts/with-node.sh pnpm typecheck`. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 2: Database schema and migration

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/migrations/0001_lessons_and_tags.sql` (+ drizzle `meta` files) via `pnpm db:generate`
- Modify: `apps/api/test/helpers.ts`
- Create: `apps/api/test/fixtures.ts`
- Test: `apps/api/src/db-constraints.test.ts`

**Interfaces:**
- Produces from `@drum-tutor/db`: tables `tags`, `lessons`, `lessonTags`, `practiceLogs`; pg enums `lessonDifficulty`, `lessonStatus` (values from `DIFFICULTIES` and `["draft", "published"]` — import the tuples from `@drum-tutor/contracts` only if `packages/db` already depends on it; otherwise repeat the literals); row types `TagRow`, `LessonRow`, `NewLessonRow`, `PracticeLogRow`.
- Produces in `apps/api/test/helpers.ts`: `resetDatabase(db)` truncates `users, tags, lessons, lesson_tags, practice_logs` (`CASCADE`).
- Produces in `apps/api/test/fixtures.ts`:
  - `loginCookies(app: FastifyInstance, email?: string): Promise<Record<string, string>>` — logs in through the API and returns `{ dt_session: value }` for `inject({ cookies })`.
  - `insertTag(db, name: string): Promise<TagRow>`
  - `insertLesson(db, values: Partial<NewLessonRow> & { tagIds: string[] }): Promise<LessonRow>` — defaults: name `"Lesson"`, description `"Description"`, `beginner`, tempo 60, duration 180, `draft`.
  - `insertPracticeLog(db, lessonId: string): Promise<PracticeLogRow>` — creates (or reuses) user `logger@example.com`, tempo 60, duration 180, `completed_at` now, `local_date` today.

- [x] **Step 1: Write the failing test** `db-constraints.test.ts`, inserting directly with Drizzle:
  - `recommended_duration_seconds` 45 and 3630, and tempo 29, are rejected by check constraints.
  - Two tags `"Groove"` and `"groove"` → the second insert fails (unique `lower(name)`).
  - Deleting a tag referenced by `lesson_tags` fails; deleting a lesson removes its `lesson_tags`; deleting a lesson with a practice log fails.
  - A new lesson defaults to `status = 'draft'`.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- db-constraints`. Expected: FAIL (tables missing).
- [x] **Step 3: Add the tables to `schema.ts`** exactly as spec §4: checks via `check()`, the unique index via `uniqueIndex().on(sql\`lower(${t.name})\`)`, index `(status, created_at, id)`on lessons, index on`lesson_tags.tag_id`and`practice_logs.lesson_id`, FK actions as in the spec. Run `scripts/with-node.sh pnpm db:generate --name lessons_and_tags`and read the SQL: it must contain the checks, the expression index and the FK actions. Then write the fixtures and the new`resetDatabase`.
- [x] **Step 4: Run** the test file, then the whole API suite (`auth.test.ts` still passes with the new truncate). Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 3: Tag endpoints (drummer + admin) and shared API helpers

**Files:**
- Modify: `apps/api/src/plugins/error-handler.ts`, `apps/api/src/app.ts`
- Create: `apps/api/src/lib/pg-errors.ts`, `apps/api/src/lib/pagination.ts`, `apps/api/src/lib/sql.ts`
- Create: `apps/api/src/modules/tags/tags.repository.ts`, `tags.routes.ts`, `admin-tags.routes.ts`
- Test: `apps/api/src/modules/tags/tags.test.ts`, `apps/api/src/modules/tags/admin-tags.test.ts`

**Interfaces:**
- Consumes: Task 1 schemas, Task 2 tables and fixtures.
- Produces:
  - `error-handler.ts`: `class AppError extends Error { constructor(readonly statusCode: number, readonly code: string, message: string, readonly details?: ApiError["error"]["details"]) }`; the handler sends `apiError(code, message, details)` with `statusCode` for it, before the existing branches. Add a unit case to `error-handler.test.ts`.
  - `lib/pg-errors.ts`: `PgErrorCode = { UNIQUE_VIOLATION: "23505", FOREIGN_KEY_VIOLATION: "23503" } as const`; `hasPgErrorCode(error: unknown, code: string): boolean` — checks `error.code` and `error.cause.code` (Drizzle wraps driver errors).
  - `lib/pagination.ts`: `pageOffset(q: PaginationQuery): number`; `toPage<T>(items: T[], q: PaginationQuery, totalItems: number): Page<T>` (`totalPages = Math.ceil(totalItems / q.pageSize)`).
  - `lib/sql.ts`: `escapeLike(value: string): string` (escapes `\`, `%`, `_`).
  - `tags.repository.ts`: `listTags(db, q: TagListQuery): Promise<Page<Tag>>`, `listAdminTags(db, q): Promise<Page<AdminTag>>`, `createTag(db, name): Promise<AdminTag>`, `renameTag(db, id, name): Promise<AdminTag>`, `deleteTag(db, id): Promise<void>`. Write functions throw `AppError` (404 `NOT_FOUND`, 409 `TAG_NAME_TAKEN` / `TAG_IN_USE`) using the exact copy. `findExistingTagIds(db, ids: string[]): Promise<Set<string>>` for Task 4.
  - Routes: `tagsRoutes` (`GET /api/tags`), `adminTagsRoutes` (spec §5.3 tag rows), both `FastifyPluginAsyncZod<{ db: Database }>` registered in `buildApp`. `requireUser` as a `preHandler` hook on each plugin.

- [x] **Step 1: Write the failing tests.** Each test logs in with `loginCookies`. `tags.test.ts`:
  - sorted case-insensitively by name, then id; `totalItems` / `totalPages` correct for 25 tags with `pageSize=10` (3 pages, last has 5);
  - `q=HAND` matches "Hand speed" and "Weak hand"; `q=%` matches only a tag named "100% wrist" and `q=_` only "left_hand" (Review Focus 3);
  - `ids=<existing>&ids=<unknown>` returns only the existing one; `ids` + `q` combine as AND;
  - no cookie → `401`; `pageSize=101` → `400 VALIDATION_ERROR`.
  - `admin-tags.test.ts`:
  - `POST {name: "  Weak   hand "}` → `201`, name `"Weak hand"`, `lessonCount: 0`;
  - `POST "weak HAND"` after it → `409 TAG_NAME_TAKEN` with message `A tag named "weak HAND" already exists`;
  - two concurrent `POST`s `"Groove"` / `"groove"` → statuses sorted equal `[201, 409]` (Review Focus 2);
  - `PATCH` to another tag's name (other case) → `409`; `PATCH` own name to `"WEAK HAND"` → `200`; `PATCH` unknown id → `404`; `PATCH /api/admin/tags/not-a-uuid` → `400` (Review Focus 4);
  - `DELETE` unused → `204`, then the tag is gone; `DELETE` a tag used only by a draft → `409 TAG_IN_USE`; `DELETE` unknown → `404`;
  - `GET /api/admin/tags` reports `lessonCount` 2 for a tag on one draft and one published lesson;
  - `GET /api/docs/json` lists `/api/tags`, `/api/admin/tags` and `/api/admin/tags/{id}`.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- tags`. Expected: FAIL.
- [x] **Step 3: Implement** helpers, repository and routes. `createTag` / `renameTag` rely on the unique index: catch `UNIQUE_VIOLATION` → `409`, no pre-check race. Renaming to a new casing of its own name passes the index naturally (same row). `deleteTag` deletes and maps `FOREIGN_KEY_VIOLATION` → `409 TAG_IN_USE`; zero deleted rows → `404`. `q` uses `ilike(name, '%' || escapeLike(q) || '%')` with the default `\` escape. `lessonCount` via a grouped subquery or `count()` with left join in the same query.
- [x] **Step 4: Run** the tag tests and the full API suite. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 4: Admin lesson endpoints with locking

**Files:**
- Create: `apps/api/src/modules/lessons/lesson-tags.ts`, `admin-lessons.repository.ts`, `admin-lessons.routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/modules/lessons/admin-lessons.test.ts`

**Interfaces:**
- Consumes: Task 3 helpers (`AppError`, `toPage`, `pageOffset`, `hasPgErrorCode`, `findExistingTagIds`).
- Produces:
  - `lesson-tags.ts`: `loadTagsForLessons(db, lessonIds: string[]): Promise<Map<string, Tag[]>>` (one query, each list sorted by `lower(name)`); `toLessonSummary(row: LessonRow, tags: Tag[]): LessonSummary`. Task 5 reuses both.
  - `admin-lessons.repository.ts`: `listAdminLessons(db, q: PaginationQuery): Promise<Page<AdminLessonSummary>>`, `getAdminLesson(db, id): Promise<AdminLesson>` (throws 404), `createLesson(db, input: LessonInput): Promise<AdminLesson>`, `updateLesson(db, id, input): Promise<AdminLesson>`, `deleteLesson(db, id): Promise<void>`, `publishLesson(db, id): Promise<AdminLesson>`, `unpublishLesson(db, id): Promise<AdminLesson>`. `locked` = `exists (select 1 from practice_logs where lesson_id = lessons.id)` in the same query as the rows.
  - `adminLessonsRoutes` with the lesson rows of spec §5.3; `POST` returns `201`.

- [x] **Step 1: Write the failing tests** (spec §7 "Lesson create/update validation" and "Lifecycle and locking"):
  - create → `201`, `status: "draft"`, `locked: false`, tags sorted by name; a body with `status: "published"` still yields `draft`;
  - validation `400`s: no tags, 11 tags, `[a, a]` (Review Focus 5), tempo 29 / 301, duration 0 / 15 / 45 / 3630; boundaries 30 / 300 BPM and 30 / 3600 s accepted;
  - unknown tag id → `400 VALIDATION_ERROR` with `details` containing `{ path: "tagIds", message: "Unknown tag: <id>" }`, and no lesson row created;
  - `PUT` replaces all fields and the tag set, keeps `status` and `createdAt`; works on a published lesson without logs;
  - with a log (`insertPracticeLog`): `PUT`, `DELETE` and `unpublish` → `409 LESSON_LOCKED`, and a re-read shows nothing changed; `publish` → `200`;
  - `unpublish` without logs → `draft`; `publish` twice and `unpublish` on a draft → `200` unchanged;
  - `DELETE` without logs → `204`, lesson and its `lesson_tags` rows gone;
  - list: drafts and published, `created_at desc, id desc`, `locked` true exactly for the lesson with a log, totals correct;
  - `GET /api/admin/lessons/<unknown>` → `404 Lesson not found`; `…/not-a-uuid` → `400` (Review Focus 4);
  - all routes → `401` without a cookie (one parameterized test).
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- admin-lessons`. Expected: FAIL.
- [x] **Step 3: Implement.** Writes run in `db.transaction`. `updateLesson`, `deleteLesson`, `unpublishLesson`: `select … from lessons where id = $1 for update` (Drizzle `.for("update")`) → 404 if missing → `exists` practice log → `409 LESSON_LOCKED` → write. `createLesson` / `updateLesson` check `findExistingTagIds` inside the transaction and throw the `400` with one detail per unknown id; a `FOREIGN_KEY_VIOLATION` on the `lesson_tags` insert (tag deleted meanwhile) maps to the same `400`. `updateLesson` deletes and re-inserts `lesson_tags`. `deleteLesson` keeps the FK backstop: map `FOREIGN_KEY_VIOLATION` → `409 LESSON_LOCKED`.
- [x] **Step 4: Run** the admin lesson tests and the full API suite. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 5: Drummer library and lesson details

**Files:**
- Create: `apps/api/src/modules/lessons/library.repository.ts`, `lessons.routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/src/modules/lessons/library.test.ts`

**Interfaces:**
- Consumes: Task 4 `loadTagsForLessons`, `toLessonSummary`; Task 3 pagination helpers.
- Produces: `listLibrary(db, q: LibraryQuery): Promise<Page<LessonSummary>>`, `getPublishedLesson(db, id): Promise<LessonDetail>` (404 for unknown or draft); `lessonsRoutes` with `GET /api/lessons` and `GET /api/lessons/:id`.

- [x] **Step 1: Write the failing tests** (spec §7 "Library"):
  - drafts never listed, and `GET /api/lessons/<draft id>` → `404 Lesson not found`;
  - `tagIds=A&tagIds=B` returns only lessons with both A and B (a lesson with A only and one with B only are excluded); `tagIds=A` (single key) works; `tagIds=A&tagIds=A` behaves like `tagIds=A`; `tagIds=garbage` → `400` (Review Focus 1);
  - `difficulties=beginner&difficulties=advanced` returns lessons of either level; combined with `tagIds` both apply;
  - unknown tag id → `200`, empty `items`, `totalItems: 0`, `totalPages: 0`;
  - `sort=newest` / `oldest` order; three lessons with the same `created_at` come out in `id desc` / `id asc` order;
  - 13 published lessons, `pageSize=12`: page 1 has 12, page 2 has 1, both report `totalItems: 13, totalPages: 2`; page 3 → `200` with `items: []` and the same totals;
  - `pageSize=0` and `pageSize=101` → `400`; no cookie → `401`;
  - details include `description` and tags sorted by name; `GET /api/docs/json` lists `/api/lessons` and `/api/lessons/{id}`.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- library`. Expected: FAIL.
- [x] **Step 3: Implement.** Base filter `status = 'published'`; difficulties with `inArray`; tag AND filter as `lessons.id in (select lesson_id from lesson_tags where tag_id in (…) group by lesson_id having count(*) = <n>)` with `n` = number of distinct ids (the contract already deduplicates). The same `where` feeds the page query (`orderBy` + `limit` + `offset`) and the `count(*)` query.
- [x] **Step 4: Run** the library tests and the full API suite. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 6: Seed, `pnpm db:seed` and docs

**Files:**
- Create: `packages/db/src/seed.ts`, `packages/db/src/seed-cli.ts`
- Modify: `packages/db/src/index.ts`, `packages/db/package.json` (`"seed": "tsx src/seed-cli.ts"`), root `package.json` (`"db:seed": "pnpm --filter @drum-tutor/db seed"`)
- Modify: `README.md` (commands table, "Reset data" section), `.claude/skills/local-dev/SKILL.md` ("Reset data": optional `db:seed` after `db:reset`)
- Test: `apps/api/src/seed.test.ts`

**Interfaces:**
- Produces: `seedDatabase(db: Database): Promise<void>` exported from `@drum-tutor/db`. `seed-cli.ts` follows `migrate-cli.ts` (loads root env, fails with the same message when `DATABASE_URL` is missing, prints `Seed data loaded.`).

- [x] **Step 1: Write the failing test** `seed.test.ts`: after `seedDatabase(db)`, through the API with a login cookie:
  - `GET /api/lessons?pageSize=12` → `totalItems: 15`, `totalPages: 2`; the three difficulties all occur;
  - `GET /api/admin/lessons?pageSize=100` → 18 items, 3 drafts, exactly one `locked`, which is published;
  - `GET /api/admin/tags` → the 6 tags of spec §4; every lesson has 1–3 tags;
  - running `seedDatabase` a second time gives the same counts, and a user created before seeding still exists.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- seed`. Expected: FAIL.
- [x] **Step 3: Implement `seedDatabase`** in one transaction: delete `practice_logs`, `lesson_tags`, `lessons`, `tags`; insert the 6 tags and 18 lessons (realistic names and descriptions, e.g. "Single strokes on a pad", "Money beat", "Paradiddle accents"; `created_at` spread over the last 30 days, all distinct); upsert `seed@example.com`; one practice log on one published lesson.
- [x] **Step 4: Run** the seed test and the full suite: `scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm typecheck && scripts/with-node.sh pnpm test`. Expected: all PASS.
- [x] **Step 5: Verify against the local app.** `scripts/dev-start.sh`, then `scripts/with-node.sh pnpm db:migrate && scripts/with-node.sh pnpm db:seed` (prints `Seed data loaded.`). Log in with `curl -c` and check `curl -b … 'http://localhost:5330/api/lessons?pageSize=12'` reports `"totalItems":15`. Open `http://localhost:5330/api/docs` and confirm the new paths render. Follow the README "Reset data" steps literally once.
- [x] **Step 6: Checkpoint.** `pnpm format`. Tick this plan's checkboxes and set its status to `done`. Commit the task's files to `main`.

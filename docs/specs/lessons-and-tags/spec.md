# Lessons and Tags — Spec

- **Status:** implemented
- **Date:** 2026-10-25
- **Related:** PRD US-2, US-3, US-4, US-5, US-6, US-16, US-17, US-17a, US-18, US-19; R5, R7, R8, R9, R10, R11, R13; ADR-0002, ADR-0003, ADR-0008, ADR-0011, ADR-0012, ADR-0021, ADR-0022, ADR-0030 – ADR-0036
- **Plans:** [plan-01-backend.md](plan-01-backend.md), [plan-02-admin-ui.md](plan-02-admin-ui.md), [plan-03-library-ui.md](plan-03-library-ui.md)

## 1. Intent

This is the second MVP scope. It builds the content side of the app: the admin curates a tag dictionary and a set of lessons, and drummers browse the published lessons in a paginated, filterable library and open a lesson's details page.

It deliberately stops short of practicing. There is no player, no practice logging, no rating and no signature (exercise notation) yet. Those come in later scopes and plug into what this scope builds:

- The details page already has the place where the signature will be drawn ("Sheet coming soon") and the **Start** button that will lead to the player (always disabled for now).
- The `practice_logs` table is created now, empty, so lesson locking (R7, R11) is real backend logic from day one. The practice scope only starts writing rows (ADR-0034).
- The library contract and UI have no rating. The rating scope adds the field, the "sort by rating" option and the display (ADR-0031).

The path established in `project-foundation` applies unchanged: Zod contract in `packages/contracts` → Fastify route validated by it → Drizzle schema and migration → TanStack Query in the SPA → TanStack Form with the same schema → integration tests on real PostgreSQL.

## 2. Goals, non-goals, anti-goals

**Goals**

- Tag dictionary managed in `/admin/tags`: add, rename, delete only when unused, unique names (US-16, R8, ADR-0011).
- Lessons managed in `/admin/lessons`: create as draft, edit, delete, publish, move back to draft, with locking once practice logs exist (US-17 without the signature, US-17a, US-18, US-19, R7, R9, R10, R11).
- A drummer library at `/lessons`: server-side pagination, tag filter (AND), difficulty filter (OR), sort by creation date, all state in the URL (US-2, US-3, US-4, US-5 without rating, R5, R13).
- A lesson details page at `/lessons/:lessonId` showing everything from the list plus the description, a signature placeholder and a disabled Start button (US-6 without rating and signature).
- A reusable tag picker: searchable on the server, infinitely scrolled, used in the library filter and the lesson form.
- Seed data so the library and admin can be checked without manual data entry.

**Non-goals (this scope)**

- The signature, in both editing and display (ADR-0030).
- Rating in any form: no field in contracts, no display, no sort by rating (ADR-0031).
- The exercise player and writing practice logs. Nothing except tests and the seed writes to `practice_logs`.
- Text search over lessons (PRD non-goal). Only tags are searchable, by name, inside the tag picker and the admin tag list.
- Filters on the admin lesson list.
- A visual design pass. Screens use stock shadcn/ui components and follow the wireframes described in §6. PRD §7 says the visual design comes later.
- A committed Playwright suite (ADR-0027 stays open).

**Anti-goals** — the scope fails if any of these happen, even if it "works"

- A draft lesson is visible or reachable to drummers (list or details).
- A lesson with a practice log can be edited, deleted or moved back to draft through any endpoint.
- A tag used by any lesson (draft or published) can be deleted, or two tags exist whose names differ only in case or whitespace.
- Filtering, sorting or counting happens on the client over a partial list, or the client fetches tags one by one to show selected tag names (ADR-0012, ADR-0033).
- The frontend computes `locked` or a tag's usage count itself instead of reading it from the API.
- A placeholder rating ("No ratings yet", "0.0") or a fake signature appears anywhere.
- A duration that is not a 30-second step, or a tempo outside 30–300, is stored.
- Refreshing the library loses its filters, sort, page or page size.

## 3. Constraints

- Everything in [TECH_STACK.md](../../TECH_STACK.md) and the accepted ADRs applies, and the patterns from [project-foundation](../project-foundation/spec.md): error shape (ADR-0022), global mutation error toasts (ADR-0021), TanStack Form with contract schemas (ADR-0020), thin fetch client (ADR-0025), integration tests on real PostgreSQL (ADR-0018).
- Every new endpoint requires a logged-in user (`requireUser`), drummer and admin endpoints alike (ADR-0035).
- UI uses stock shadcn/ui components wherever one fits. If adding a shadcn component pulls in a new npm dependency (for example `cmdk` for Command), the builder records it in an ADR during execution, as was done with ADR-0028.
- Code, docs, UI text and test data in English.

## 4. Data model (`packages/db`)

One migration adds the tables below. Enum values are lowercase strings shared with the contracts.

**`tags`**

| Column       | Type          | Rules                                                                                  |
| ------------ | ------------- | -------------------------------------------------------------------------------------- |
| `id`         | `uuid`        | PK, `defaultRandom()`                                                                  |
| `name`       | `text`        | not null; stored normalized (ADR-0036)                                                 |
| `created_at` | `timestamptz` | not null, default `now()`                                                              |
|              |               | **unique index on `lower(name)`** — the database is the final guard against duplicates |

**`lessons`**

| Column                         | Type                        | Rules                                                |
| ------------------------------ | --------------------------- | ---------------------------------------------------- |
| `id`                           | `uuid`                      | PK, `defaultRandom()`                                |
| `name`                         | `text`                      | not null                                             |
| `description`                  | `text`                      | not null                                             |
| `difficulty`                   | pg enum `lesson_difficulty` | `beginner` \| `intermediate` \| `advanced`           |
| `recommended_tempo_bpm`        | `integer`                   | not null; check `between 30 and 300`                 |
| `recommended_duration_seconds` | `integer`                   | not null; check `between 30 and 3600` and `% 30 = 0` |
| `status`                       | pg enum `lesson_status`     | `draft` \| `published`; not null, default `draft`    |
| `created_at`                   | `timestamptz`               | not null, default `now()`                            |

Index on `(status, created_at, id)` for the library query. No signature column (ADR-0030).

**`lesson_tags`**

| Column      | Type   | Rules                                                  |
| ----------- | ------ | ------------------------------------------------------ |
| `lesson_id` | `uuid` | FK → `lessons.id`, `on delete cascade`                 |
| `tag_id`    | `uuid` | FK → `tags.id`, `on delete restrict` (backstop for R8) |
|             |        | PK `(lesson_id, tag_id)`; index on `tag_id`            |

**`practice_logs`** (ADR-0034) — created empty; columns follow PRD §4.4.

| Column             | Type          | Rules                                                                  |
| ------------------ | ------------- | ---------------------------------------------------------------------- |
| `id`               | `uuid`        | PK, `defaultRandom()`                                                  |
| `user_id`          | `uuid`        | FK → `users.id`, `on delete cascade`                                   |
| `lesson_id`        | `uuid`        | FK → `lessons.id`, `on delete restrict` (backstop for R7)              |
| `duration_seconds` | `integer`     | not null; same checks as `recommended_duration_seconds`                |
| `tempo_bpm`        | `integer`     | not null; check `between 30 and 300`                                   |
| `completed_at`     | `timestamptz` | not null                                                               |
| `local_date`       | `date`        | not null; the user's local calendar date at completion (R12, ADR-0007) |
|                    |               | index on `lesson_id`                                                   |

The practice scope may add columns (e.g. an idempotency key for US-11b) in its own migration.

**Seed.** A new root script `pnpm db:seed` runs `packages/db/src/seed.ts`. It deletes all rows from `practice_logs`, `lesson_tags`, `lessons` and `tags` (users are kept), then inserts:

- 6 tags: Hand speed, Weak hand, Kick drum foot, Hi-hat foot, Rudiments, Groove.
- 18 lessons with names and descriptions that read like real exercises, spread over all three difficulties, every lesson with 1–3 tags, `created_at` spread over the last weeks so both sort orders differ visibly. 15 published, 3 drafts. This gives two library pages at the default page size of 12.
- One practice log on one published lesson, owned by a seed user `seed@example.com` (created if missing), so a locked lesson exists.

`db:reset` stays as it is (empty database). README and the `local-dev` skill document `db:seed`.

## 5. API contract (`packages/contracts`)

### 5.1 Shared shapes

**Pagination (ADR-0032).**

```ts
PaginationQuery = {
  page: number;      // integer ≥ 1, default 1
  pageSize: number;  // integer 1–100, default 20
}

Page<T> = {
  items: T[];
  page: number;        // echoed
  pageSize: number;    // echoed
  totalItems: number;  // count of the whole filtered result set
  totalPages: number;  // ceil(totalItems / pageSize); 0 when totalItems is 0
}
```

A page beyond the last one is not an error: it returns `200` with `items: []` and the real totals. Query values arrive as strings and are coerced by the schema. Array parameters are sent as repeated keys (`tagIds=a&tagIds=b`); a single value is accepted as a one-element array. Duplicates in arrays are ignored.

**Enums.** `Difficulty = "beginner" | "intermediate" | "advanced"`, `LessonStatus = "draft" | "published"`, `LessonSort = "newest" | "oldest"`.

**Tag name (ADR-0036).** `TagNameSchema` trims, collapses inner runs of whitespace to one space, then requires 1–50 characters. It is the one definition used by the admin form, the API and the database write. Uniqueness is case-insensitive.

**Lesson input.**

```ts
LessonInput = {
  name: string;                        // trimmed, 1–120 chars
  description: string;                 // trimmed, 1–5000 chars, plain text
  difficulty: Difficulty;
  tagIds: string[];                    // uuids, 1–10, no duplicates — a repeated id is a 400 (R9)
  recommendedTempoBpm: number;         // integer 30–300 (R10)
  recommendedDurationSeconds: number;  // integer 30–3600, multiple of 30 (R10)
}
```

**Response DTOs.**

```ts
Tag = { id: string; name: string }
AdminTag = Tag & { lessonCount: number }   // lessons using the tag, drafts included

LessonSummary = {
  id: string;
  name: string;
  difficulty: Difficulty;
  tags: Tag[];                        // sorted by name, case-insensitive
  recommendedTempoBpm: number;
  recommendedDurationSeconds: number;
  createdAt: string;                  // ISO 8601
}
LessonDetail = LessonSummary & { description: string }

AdminLessonSummary = LessonSummary & { status: LessonStatus; locked: boolean }
AdminLesson = LessonDetail & { status: LessonStatus; locked: boolean }
```

`locked` is `true` when the lesson has at least one practice log (ADR-0003). No rating fields anywhere (ADR-0031).

**New error codes** added to `ApiErrorCode`: `TAG_NAME_TAKEN`, `TAG_IN_USE`, `LESSON_LOCKED`. Missing resources use the existing `NOT_FOUND`. All errors use the ADR-0022 shape.

### 5.2 Drummer endpoints

| Method & path          | Request                                                                                                                 | Success                   | Errors                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------- |
| `GET /api/lessons`     | `PaginationQuery` + `tagIds?: uuid[]` (max 20) + `difficulties?: Difficulty[]` + `sort?: LessonSort` (default `newest`) | `200 Page<LessonSummary>` | `400 VALIDATION_ERROR`, `401`                                                       |
| `GET /api/lessons/:id` | —                                                                                                                       | `200 LessonDetail`        | `404 NOT_FOUND` for an unknown **or draft** lesson; `400` for a malformed id; `401` |
| `GET /api/tags`        | `PaginationQuery` + `q?: string` (trimmed, max 50) + `ids?: uuid[]` (max 100)                                           | `200 Page<Tag>`           | `400`, `401`                                                                        |

`GET /api/lessons` rules:

- Only `published` lessons.
- `tagIds`: a lesson matches only if it has **all** given tags (R5, AND). Unknown tag ids are not an error; they simply match nothing.
- `difficulties`: a lesson matches if its difficulty is **any** of the given ones (R5, OR). Empty or absent = no difficulty filter.
- `sort=newest` → `created_at desc, id desc`; `sort=oldest` → `created_at asc, id asc`. The id tie-breaker keeps pagination stable.
- `totalItems` counts the whole filtered set (R13). Filtering, sorting and paging happen in SQL.

`GET /api/tags` rules (ADR-0033):

- Sorted by `lower(name)`, then `id`.
- `q`: case-insensitive substring match on the name. `%`, `_` and `\` in `q` are matched literally. Empty after trimming = no filter.
- `ids`: return only these tags (used to resolve names of tags selected in the URL in one call). Combined with `q` as AND. Unknown ids are left out of the result, not an error.

### 5.3 Admin endpoints

| Method & path                           | Request                       | Success                        | Errors                                    |
| --------------------------------------- | ----------------------------- | ------------------------------ | ----------------------------------------- |
| `GET /api/admin/tags`                   | same query as `GET /api/tags` | `200 Page<AdminTag>`           | `400`, `401`                              |
| `POST /api/admin/tags`                  | `{ name }`                    | `201 AdminTag`                 | `400`, `409 TAG_NAME_TAKEN`, `401`        |
| `PATCH /api/admin/tags/:id`             | `{ name }`                    | `200 AdminTag`                 | `400`, `404`, `409 TAG_NAME_TAKEN`, `401` |
| `DELETE /api/admin/tags/:id`            | —                             | `204`                          | `404`, `409 TAG_IN_USE`, `401`            |
| `GET /api/admin/lessons`                | `PaginationQuery`             | `200 Page<AdminLessonSummary>` | `400`, `401`                              |
| `GET /api/admin/lessons/:id`            | —                             | `200 AdminLesson`              | `404`, `400`, `401`                       |
| `POST /api/admin/lessons`               | `LessonInput`                 | `201 AdminLesson` (`draft`)    | `400` (incl. unknown tag ids), `401`      |
| `PUT /api/admin/lessons/:id`            | `LessonInput`                 | `200 AdminLesson`              | `400`, `404`, `409 LESSON_LOCKED`, `401`  |
| `DELETE /api/admin/lessons/:id`         | —                             | `204`                          | `404`, `409 LESSON_LOCKED`, `401`         |
| `POST /api/admin/lessons/:id/publish`   | —                             | `200 AdminLesson`              | `404`, `401`                              |
| `POST /api/admin/lessons/:id/unpublish` | —                             | `200 AdminLesson`              | `404`, `409 LESSON_LOCKED`, `401`         |

Rules:

- **Tags.** A rename to a name that only another tag has (case-insensitively) is `409 TAG_NAME_TAKEN`; renaming a tag to a different casing of its own name is allowed. Rename is allowed regardless of usage (R8). Delete is `409 TAG_IN_USE` when any lesson, draft or published, uses the tag. Duplicate checks rely on the unique index, so concurrent creates cannot both succeed; the unique-violation and FK-violation errors are mapped to the 409 codes.
- **Admin tag list** sorts by name like `GET /api/tags`; `lessonCount` comes from the same query, not a request per tag.
- **Admin lesson list** contains drafts and published lessons, sorted `created_at desc, id desc`. `locked` comes from the same query.
- **Create** always produces a `draft` (R11), whatever the client sends. Unknown `tagIds` → `400 VALIDATION_ERROR` with a `details` entry on path `tagIds`.
- **Update** (`PUT`) replaces all fields and the full tag set. Allowed for drafts and for published lessons without logs (US-18). Status is not changed by `PUT`.
- **Locking (R7, R11, ADR-0003).** `PUT`, `DELETE` and `unpublish` load the lesson with `SELECT … FOR UPDATE` inside a transaction, check for practice logs in the same transaction, and return `409 LESSON_LOCKED` if any exist. The `practice_logs.lesson_id` FK with `on delete restrict` is the backstop for delete. When the practice scope starts inserting logs, it must take a lock on the lesson row that conflicts with `FOR UPDATE` (e.g. `SELECT … FOR SHARE`) so a log cannot slip in between an admin's check and write.
- **Publish** is idempotent: publishing a published lesson returns `200` unchanged. **Unpublish** of a draft is likewise `200` unchanged. Publishing does not require a signature (ADR-0030).

### 5.4 OpenAPI and paths

All new routes are registered with their Zod schemas so they appear in `/api/docs`. Paths are added to `ApiPaths`.

## 6. Web app (`apps/web`)

### 6.1 Routes and shells

| Route                           | Screen                                                        |
| ------------------------------- | ------------------------------------------------------------- |
| `/`                             | redirects to `/lessons` (replaces the foundation placeholder) |
| `/lessons`                      | library                                                       |
| `/lessons/$lessonId`            | lesson details                                                |
| `/admin`                        | redirects to `/admin/lessons`                                 |
| `/admin/lessons`                | admin lesson list                                             |
| `/admin/lessons/new`            | create lesson                                                 |
| `/admin/lessons/$lessonId/edit` | edit lesson                                                   |
| `/admin/tags`                   | tag dictionary                                                |

All of them sit under the existing `_authenticated` layout, so `/admin` needs the same email login (ADR-0035). There is no link to `/admin` in the drummer app; the admin knows the URL (PRD §3, ADR-0002).

- **Drummer shell:** header with "Drum Tutor", a "Library" link, the user's email and "Log out" (the logout behaviour from the foundation moves here).
- **Admin shell:** header "Drum Tutor · Admin" with "Back to app", and a left nav with "Lessons" and "Tags".

### 6.2 Shared behaviour

- **Loading:** list screens show **skeletons** shaped like the content (cards in the library, table rows in admin), one per page slot. Skeletons show whenever the query for the current parameters has no data yet, including after a filter or page change.
- **Query errors:** an inline Alert with a "Try again" button that refetches. Mutation errors keep the global toast (ADR-0021), except where §6.5 says otherwise.
- **Lost session:** a `401 UNAUTHENTICATED` from any query or mutation clears the query cache and redirects to `/login`, instead of showing an inline error or toast (e.g. after `db:reset` removed the user).
- **Success feedback:** admin mutations show a short success toast ("Lesson published", "Tag deleted", …) and invalidate the affected queries.
- **Not found:** an unknown lesson id (or a draft on the drummer side) shows a "Lesson not found" page with a link back.

### 6.3 Tag picker (shared component)

Used by the library filter and the lesson form.

- shadcn Popover + Command with client filtering turned off. The search input sends `q` to `GET /api/tags` (debounced, ~300 ms). Results load with `useInfiniteQuery`, 20 per page; the next page loads when the end of the list scrolls into view (IntersectionObserver, no library).
- Items are checkbox-style; selecting toggles a tag. The trigger shows "Tags" plus the count of selected tags. Selected tags also show as removable Badges outside the popover.
- Names of selected tags come from **one** `GET /api/tags?ids=…` call (ADR-0033), never from the loaded pages or one request per tag.
- Empty results show "No tags found".

### 6.4 Library and details (drummer)

**Library `/lessons`.**

- **URL is the state.** Search params, validated with a Zod schema through TanStack Router: `page` (default 1), `pageSize` (12 \| 24 \| 48, default 12), `tagIds` (array), `difficulties` (array), `sort` (`newest` \| `oldest`, default `newest`). Invalid or unknown values fall back to defaults rather than failing the page. Refresh, back/forward and shared links restore the same view. Changing any filter, the sort or the page size resets `page` to 1.
- **Filters row:** tag picker; difficulty ToggleGroup with multiple selection (Beginner, Intermediate, Advanced); sort Select ("Newest first" / "Oldest first"); a "Clear filters" button when any filter is set. Below: selected tag Badges (removable) and the result count ("14 lessons") from `totalItems`.
- **Unknown tag ids in the URL:** after the `ids` lookup, ids the API did not return are removed from the URL (replace, not push), so no filter without a name is shown.
- **Results:** a grid of Cards. Each card: name, difficulty Badge, tag Badges, "{tempo} BPM · {m:ss}". The whole card links to the details page.
- **Pagination:** shadcn Pagination built from `page` and `totalPages` (Previous / numbers with ellipsis / Next) and a "Per page" Select. Hidden when `totalPages ≤ 1`, except the per-page Select stays.
- **Page out of range:** if `page > totalPages` and `totalPages > 0`, navigate (replace) to `page = totalPages`.
- **Empty states** (shadcn Empty):
  - no filters set and `totalItems = 0` → "No lessons yet" / "New lessons will show up here once they are published." No action.
  - any filter set and `totalItems = 0` → "No lessons match these filters" / "Try removing a tag or selecting more levels." with a "Clear filters" button.

**Details `/lessons/$lessonId`.**

- "‹ Back to library" returns to the library with the filters, sort and page the user came from (if they arrived from the library), otherwise to `/lessons`.
- Name as the page heading; difficulty and tag Badges; "Recommended: {tempo} BPM · {m:ss}"; the description as plain text with line breaks preserved.
- A bordered, dashed box with the text "Sheet coming soon" where the signature will go (ADR-0030).
- A primary **Start** button, always disabled in this scope.

### 6.5 Admin

**Lessons `/admin/lessons`.**

- Header "Lessons" with a "New lesson" button.
- Table columns: Name (with a lock icon and tooltip "Has practice logs" when `locked`), Difficulty, Tags (first tag + "+N" Badge), Status Badge (Draft / Published), Created (date), row actions.
- Pagination as in the library, `pageSize` 20 \| 50 \| 100 (default 20), kept in the URL search params as well.
- Row actions in a DropdownMenu:
  - **Edit** → edit page.
  - **Publish** (drafts) or **Move to draft** (published) — run immediately, no confirmation.
  - **Delete** → AlertDialog confirmation, then delete.
  - For a `locked` lesson, Edit, Move to draft and Delete are shown disabled.
- Empty state: "No lessons yet" with a "New lesson" button. Loading: skeleton rows.

**Lesson form** (create and edit share one component, TanStack Form with `LessonInputSchema`):

| Field       | Control                                                                                                                                                               | Default (create) |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Name        | Input                                                                                                                                                                 | empty            |
| Description | Textarea                                                                                                                                                              | empty            |
| Difficulty  | RadioGroup (Beginner, Intermediate, Advanced)                                                                                                                         | none selected    |
| Tags        | tag picker (§6.3), selected tags as removable Badges                                                                                                                  | none             |
| Tempo       | Slider 30–300 step 1, kept in sync with a number Input next to it ("BPM"). An out-of-range typed value shows the schema error; the slider keeps the last valid value. | 60               |
| Duration    | Read-only `MM:SS` display between a "−" and a "+" Button; each press changes the value by 30 s. "−" is disabled at 00:30, "+" at 60:00. **No typing.**                | 03:00            |
- Field errors come from the contract schema and show under the field. While saving, fields and buttons are disabled and Save shows a spinner (foundation pattern).
- **Create** → `POST`, success toast "Lesson created", navigate to `/admin/lessons`.
- **Edit** loads `GET /api/admin/lessons/:id`. The page is reachable for a locked lesson only by typing its URL, since the menu item is disabled. If `locked`, an Alert "This lesson is locked — someone has already practiced it, so it can't be edited or deleted." appears above the form and every field and Save are disabled. A `409 LESSON_LOCKED` on save (the lesson got locked meanwhile) shows the global toast and refetches the lesson, which turns on the locked state.

**Tags `/admin/tags`.**

- An "Add tag" form at the top (Input + Button, TanStack Form with `TagNameSchema`). `409 TAG_NAME_TAKEN` is shown as an error under the input instead of a toast (the mutation opts out of the global toast through `meta`, ADR-0021).
- A search Input (server-side `q`, debounced) and a Table of tags with columns Name, Used by ("{n} lessons" or "—"), actions. The list loads with `useInfiniteQuery` on `GET /api/admin/tags`, 20 per page, more on scroll.
- **Rename** inline: a pencil button turns the name into an Input with Save / Cancel; Enter saves, Escape cancels. `TAG_NAME_TAKEN` shows under that input.
- **Delete:** a trash button, disabled with tooltip "Used by lessons" when `lessonCount > 0`; otherwise AlertDialog confirmation, then delete.
- Empty states: "No tags yet" (no search) and "No tags match "{q}"" (with search).

## 7. Tests

**API integration tests** (Vitest + Testcontainers, ADR-0018). The between-test reset truncates the new tables too (today it only truncates `users`). Practice logs are inserted directly into the database where a case needs a locked lesson. Required cases:

- **Tags:** create returns `201`; names are normalized (`"  Weak   hand "` → `"Weak hand"`); a duplicate differing only in case or whitespace → `409 TAG_NAME_TAKEN`; rename to another tag's name → `409`; rename to a new casing of its own name → `200`; delete unused → `204`; delete a tag used by a draft → `409 TAG_IN_USE`; delete unknown → `404`; `lessonCount` counts drafts and published lessons.
- **Tag lists:** sorted by name; `q` matches case-insensitively and treats `%` and `_` literally; `ids` returns only existing ids from the list; pagination totals are correct; `GET /api/tags` needs a session (`401` without).
- **Lesson create/update validation:** missing tags, more than 10 tags, unknown tag id, tempo 29 / 301, duration 0 / 15 / 3630 / 45 → `400`; boundary values 30, 300, 30 s, 3600 s accepted; create always yields `draft` even if the body tries to set a status.
- **Lifecycle and locking:** publish → visible in the library; unpublish without logs → back to draft and hidden; with a log: `PUT`, `DELETE` and `unpublish` → `409 LESSON_LOCKED` and nothing changes; publish of a locked lesson is `200`; delete without logs removes the lesson and its `lesson_tags`; `locked` is `true` in admin list and detail exactly when a log exists.
- **Library:** drafts never appear in the list and their details return `404`; tag filter with two tags returns only lessons having both; difficulty filter with two levels returns lessons of either; both filters combined; unknown tag id → empty page, `200`; `newest` / `oldest` order with equal `created_at` values ordered by id; `totalItems` / `totalPages` across pages; a page beyond the last → `200` with empty `items` and real totals; `pageSize` 0 and 101 → `400`; repeated and single-value array params both work.

**Contract unit tests** (`packages/contracts`): `TagNameSchema` normalization and length limits; `LessonInputSchema` tempo and duration rules.

**UI verification** (ADR-0027): with the app started through the `local-dev` skill and seeded with `db:seed`, drive in a real browser with the Playwright plugin:

- library: filters, sort, pagination, per-page change, refresh keeps state, both empty states, skeletons visible on load, unknown tag id dropped from the URL;
- details page: back keeps the library state, Start disabled, "Sheet coming soon";
- admin: create (defaults 60 BPM / 03:00, ± buttons and their limits), edit, publish → appears in library, move to draft → disappears, delete with confirmation, locked lesson shows disabled actions and a read-only edit page;
- tags: add, duplicate error inline, rename inline, search with infinite scroll (seed more tags in the browser session if needed), delete disabled for a used tag.

The `local-dev` skill's e2e section is updated with these flows.

## 8. Plans

- **`plan-01-backend.md`:** migration, contracts, all endpoints in §5, seed and `db:seed`, integration and contract tests, README/skill updates for the seed. Verifiable through tests and `/api/docs`.
- **`plan-02-admin-ui.md`:** shells and routes, shared UI states, the tag picker, `/admin/lessons` (list and form) and `/admin/tags`. Verifiable in the browser against the seed.
- **`plan-03-library-ui.md`:** `/` redirect, `/lessons` with URL state, filters, pagination and empty states, `/lessons/$lessonId`. Verifiable in the browser.

Plans 02 and 03 both depend on 01. Plan 03 reuses the tag picker and shells from 02.

## 9. Decisions recorded with this scope

| ADR                                                                     | Decision                                                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [ADR-0030](../../adr/0030-defer-lesson-signature.md)                    | Lessons are created and published without a signature until the signature scope (tech-debt) |
| [ADR-0031](../../adr/0031-library-without-rating-until-rating-scope.md) | No rating in the library contract or UI until the rating scope                              |
| [ADR-0032](../../adr/0032-offset-pagination-contract.md)                | Offset pagination: 1-based `page` + `pageSize` in, page with totals out                     |
| [ADR-0033](../../adr/0033-tag-lookup-with-search-and-ids.md)            | Tags are read through one paginated endpoint with server-side name search and lookup by ids |
| [ADR-0034](../../adr/0034-create-practice-logs-table-before-logging.md) | Create the `practice_logs` table before logging exists, so lesson locking is real now       |
| [ADR-0035](../../adr/0035-admin-panel-behind-email-login.md)            | `/admin` sits behind the same email login as the drummer app                                |
| [ADR-0036](../../adr/0036-normalize-tag-names.md)                       | Tag names are trimmed and whitespace-collapsed; uniqueness is case-insensitive              |

## 10. PRD tracking

When all plans are done, tick US-3, US-4, US-16, US-17a, US-18 and US-19 in the PRD, with `lessons-and-tags` as the delivering scope. US-2, US-5 and US-6 stay unticked (rating missing), and so does US-17 (signature missing).

## 11. Left to the builder

- Module layout inside `apps/api` and `apps/web`, following the `auth` / `health` modules and `features/auth`.
- SQL shape of the AND tag filter and of `lessonCount` / `locked`, as long as each list is one query plus one count (no per-row queries).
- How the "back to library" link remembers the library search params.
- Whether the admin nav uses the shadcn Sidebar component or a simpler nav built from stock components.
- Exact UI text beyond what §6 quotes, and the seed's lesson names and descriptions.

## 12. Claude's calls

- Page numbers are 1-based. Shared `pageSize` limit is 1–100 (default 20); the library UI offers 12/24/48 (default 12), admin 20/50/100 (default 20). In the brainstorm I said the API would cap at 48; a single shared cap is simpler and the UI choices stay as discussed.
- The empty-state choice (empty library vs. filters too narrow) is made by the frontend from its own filter state; the API needs nothing extra for it.
- Unknown tag ids are not an error in the library filter (they just match nothing), and the UI drops them from the URL after the `ids` lookup.
- The tag picker lists all tags, including those not used by any published lesson.
- Tag name max 50 chars; lesson name max 120, description max 5000; a lesson has at most 10 tags; the library accepts at most 20 `tagIds`.
- When − / + is pressed on the duration, the value is always a valid 30-second step, because typing is not possible.
- Publish / unpublish are idempotent and use `POST …/publish` / `…/unpublish` instead of a status field in `PUT`, so `PUT` never changes status by accident.
- Admin mutations show success toasts; the duplicate tag name error is shown inline instead of as a toast.
- `db:seed` wipes content tables and keeps users; `db:reset` stays empty.
- Skeletons replace content on every parameter change (no "keep previous page while loading").
- A `401` anywhere in the new screens redirects to `/login`, following the foundation's `_authenticated` behaviour.
- Duplicate ids are ignored in query-string arrays (filters) but rejected in `LessonInput.tagIds`, where they signal a client bug.
- Changing the page size resets to page 1.

## Changelog

- 2026-10-25 — Execution decisions recorded after the backend review:
  - `ON DELETE RESTRICT` raises SQLSTATE 23001 (`restrict_violation`), not 23503, so the tag-delete and lesson-delete backstops map both 23001 and 23503 to their 409 errors.
  - `PUT /api/admin/lessons/:id` error precedence is 404 (unknown lesson) → 409 `LESSON_LOCKED` → 400 (unknown tag).
  - Unpublishing a lesson that is already a draft returns 200 with the lesson unchanged, without checking practice logs (a draft with logs is no longer rejected).
- 2026-10-25 — Admin UI decisions recorded after the whole-branch review:
  - The admin lesson list shows 5 skeleton rows while loading (not one per page slot); the library keeps one skeleton per page slot.
  - A malformed `lessonId` (API 400) and an unknown one (404) both show "Lesson not found".
  - Search-param schemas use `.default().catch()`, so defaults appear in the URL and invalid values fall back to them.
  - `pageItems` lists every page when `totalPages` ≤ 5.
  - A Biome override relaxes lint rules for vendored shadcn files (ADR-0037).
  - Knowingly left admin UI gaps are tracked in ADR-0038.
- 2026-10-25 — Knowingly left library UI gaps are tracked in ADR-0039.
- 2026-10-26 — Superseded in part by [signature](../signature/spec.md) §6.2 and ADR-0053: publishing now requires a signature with at least one note, so the §5.3 rule "publishing does not require a signature" no longer holds.

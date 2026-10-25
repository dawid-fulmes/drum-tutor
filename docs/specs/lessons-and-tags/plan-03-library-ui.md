# Lessons and Tags — Plan 03: Library UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
- **Status:** approved

**Goal:** The drummer side of spec §6.4: `/` redirecting to `/lessons`, the library with URL-held filters, sort and pagination, both empty states and skeletons, and the lesson details page with the signature placeholder and a disabled Start button. Then close the scope (PRD ticks, statuses).

**Architecture:** The URL is the only source of library state: a Zod `validateSearch` schema with per-field fallbacks parses it, the controls render from it, and every change is a `navigate({ search })`. The library query is keyed by the parsed search, so back/forward and refresh just work. Reuses the shells, `PaginationBar`, `QueryError`, `NotFound`, `TagPicker`, `SelectedTags`, `useTagsByIds`, `lessonKeys` and `formatDuration` / `formatDifficulty` from plan 02.

**Tech Stack:** React 19, TanStack Router / Query, shadcn/ui, Vitest 5 for pure functions.

**Spec:** [spec.md](spec.md) · **Depends on:** [plan-01-backend.md](plan-01-backend.md) and [plan-02-admin-ui.md](plan-02-admin-ui.md) done.

## Global Constraints

- [spec.md](spec.md) wins over this plan if they disagree. Raise the conflict instead of picking one silently.
- **Git:** each task ends with one commit to `main` containing exactly that task's files (the user allowed committing to `main` for the local MVP on 2026-10-25). Never branch, push, stash, rebase or reset. Commit messages: short imperative summary, no `Co-Authored-By` or any AI attribution.
- Run every `pnpm` command through `scripts/with-node.sh`.
- Stock shadcn/ui components only, as installed in plan 02; no new dependencies.
- No rating anywhere (ADR-0031) and no signature rendering (ADR-0030). No placeholder rating text.
- Filtering, sorting, counting and paging come from the API. The UI never filters or counts lessons itself.
- Library state is never copied into component state; controls read the parsed search params.
- Exact UI copy is quoted in the steps; other text is the builder's choice, in English.
- Run `scripts/with-node.sh pnpm format` before closing each task.

## Review Focus

1. **Hand-edited or garbage URLs** such as `?page=abc&pageSize=7&difficulties=["expert"]&sort=best&tagIds=["x"]` must render the library with defaults for the bad fields, never an error page. Unit-tested in Task 1.
2. **A deleted tag's id in the URL.** It must be dropped from the URL with `replace` (no extra history entry), and the results must reflect the remaining filters. Checked in Task 4.
3. **Pages that no longer exist.** A typed `?page=9` must be replaced by the last page. A filter change must reset to page 1. With zero results on `?page=3`, the empty state must show, with no redirect loop (`totalPages` is 0). Implemented in Task 2, checked in Task 4.
4. **Back and forward between filter states** must restore both the controls and the results. Checked in Task 4.
5. **Details for a draft, an unknown id or a malformed id** (`/lessons/abc`, which the API answers with `400`) must show "Lesson not found", never the generic route error. Implemented in Task 3, checked in Task 4.

---

### Task 1: Library search params, lesson queries and the `/` redirect

**Files:**
- Create: `apps/web/src/features/lessons/library-search.ts`, `apps/web/src/features/lessons/lessons.api.ts`
- Modify: `apps/web/src/features/admin-lessons/admin-lessons.api.ts` (add the `library` keys to `lessonKeys`, or move `lessonKeys` to `features/lessons/lesson-keys.ts` and import it from both)
- Modify: `apps/web/src/routes/_authenticated/_app/index.tsx` (placeholder → `beforeLoad` redirect to `/lessons`), `apps/web/src/routes/_authenticated/_app.tsx` ("Library" link → `/lessons`), `apps/web/src/routes/login.tsx` and `features/auth/auth.api.ts` if they navigate to `/` (keep `/`, it redirects)
- Create: `apps/web/src/routes/_authenticated/_app/lessons/index.tsx` (route with `validateSearch` only; page body in Task 2)
- Test: `apps/web/src/features/lessons/library-search.test.ts`

**Interfaces:**
- Produces:
  - `LIBRARY_PAGE_SIZES = [12, 24, 48] as const`.
  - `librarySearchSchema` — `page` int ≥ 1 `.catch(1)`; `pageSize` one of `LIBRARY_PAGE_SIZES` `.catch(12)`; `tagIds` array of uuids, max 20, deduplicated, `.catch([])`; `difficulties` array of `Difficulty`, deduplicated, `.catch([])`; `sort` `LessonSort` `.catch("newest")`. All fields have defaults, so `/lessons` with no params parses. `type LibrarySearch`.
  - `hasActiveFilters(search: LibrarySearch): boolean` — true when `tagIds` or `difficulties` is non-empty (sort is not a filter).
  - `libraryQueryOptions(search: LibrarySearch)` → `GET /api/lessons` with `{ page, pageSize, tagIds, difficulties, sort }`, parsed with `pageSchema(LessonSummarySchema)`, key `lessonKeys.library.list(search)`.
  - `lessonQueryOptions(id: string)` → `GET /api/lessons/:id`, `LessonDetailSchema`, key `lessonKeys.library.detail(id)`.

- [ ] **Step 1: Write the failing tests**

```ts
expect(librarySearchSchema.parse({})).toEqual({
  page: 1,
  pageSize: 12,
  tagIds: [],
  difficulties: [],
  sort: "newest",
});
expect(
  librarySearchSchema.parse({
    page: "abc",
    pageSize: 7,
    difficulties: ["expert"],
    sort: "best",
    tagIds: ["x"],
  }),
).toEqual({ page: 1, pageSize: 12, tagIds: [], difficulties: [], sort: "newest" });
expect(
  librarySearchSchema.parse({
    pageSize: 24,
    difficulties: ["beginner", "beginner"],
    tagIds: [A, A],
  }),
).toMatchObject({ pageSize: 24, difficulties: ["beginner"], tagIds: [A] });
expect(hasActiveFilters(librarySearchSchema.parse({ sort: "oldest" }))).toBe(false);
expect(hasActiveFilters(librarySearchSchema.parse({ difficulties: ["advanced"] }))).toBe(true);
```

- [ ] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/web test`. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces and route changes above. Check that TanStack Router's default search serialization round-trips the arrays (reload `/lessons?…` built by a `navigate`).
- [ ] **Step 4: Run** the web tests and typecheck. In the browser, `/` lands on `/lessons` inside the drummer shell.
- [ ] **Step 5: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 2: Library screen

**Files:**
- Modify: `apps/web/src/routes/_authenticated/_app/lessons/index.tsx`
- Create: `apps/web/src/features/lessons/library-page.tsx`, `library-filters.tsx`, `lesson-card.tsx`, `lesson-card-skeleton.tsx`, `library-empty.tsx`

**Interfaces:**
- Consumes: Task 1 search schema and queries; plan 02 `TagPicker`, `SelectedTags`, `useTagsByIds`, `PaginationBar`, `QueryError`, `formatDuration`, `formatDifficulty`.
- Produces: `<LessonCard lesson={LessonSummary} librarySearch={LibrarySearch} />` — the whole card is a `Link` to `/lessons/$lessonId` carrying `librarySearch` in history `state` (used by Task 3).

- [ ] **Step 1: Implement the screen** per spec §6.4 "Library":
  - **Filters row:** `TagPicker` bound to `search.tagIds`; difficulty ToggleGroup (`type="multiple"`, items Beginner / Intermediate / Advanced) bound to `search.difficulties`; sort Select "Newest first" / "Oldest first"; a "Clear filters" Button shown when `hasActiveFilters`. Every change navigates with the new search and `page: 1`; changing the page size also resets `page` to 1.
  - **Below the row:** `SelectedTags` for `search.tagIds` (removing one updates the URL) and the count from `totalItems`: `"1 lesson"` / `"{n} lessons"`.
  - **Unknown tag ids:** when `useTagsByIds(search.tagIds)` succeeds with fewer tags than requested, navigate with `replace: true` keeping only the returned ids (Review Focus 2).
  - **Results:** a responsive grid of `LessonCard` — name, difficulty Badge, tag Badges, `"{tempo} BPM · {formatDuration(duration)}"`.
  - **Loading:** `pageSize` skeleton cards whenever the query for the current search has no data (no `placeholderData`).
  - **Error:** `QueryError` with retry.
  - **Pagination:** `PaginationBar` with `LIBRARY_PAGE_SIZES`. If `page > totalPages && totalPages > 0`, navigate (`replace`) to `page: totalPages` (Review Focus 3).
  - **Empty states** (shadcn Empty): with no active filters and `totalItems = 0` → "No lessons yet" / "New lessons will show up here once they are published.", no action; with active filters and `totalItems = 0` → "No lessons match these filters" / "Try removing a tag or selecting more levels." plus a "Clear filters" Button.
- [ ] **Step 2: Run** typecheck and the web tests. In the browser (seeded): 15 lessons over 2 pages at 12; selecting "Beginner" and "Advanced" narrows; two tags narrow further; reload keeps everything.
- [ ] **Step 3: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 3: Lesson details screen

**Files:**
- Create: `apps/web/src/routes/_authenticated/_app/lessons/$lessonId.tsx`, `apps/web/src/features/lessons/lesson-details.tsx`
- Modify: `apps/web/src/router.tsx` (declare the history state type `{ librarySearch?: LibrarySearch }` for TanStack Router)

**Interfaces:**
- Consumes: Task 1 `lessonQueryOptions`; Task 2 history state; plan 02 `NotFound`, `QueryError`.

- [ ] **Step 1: Implement the screen** per spec §6.4 "Details":
  - "‹ Back to library" links to `/lessons` with `location.state.librarySearch` when present, otherwise plain `/lessons`.
  - The lesson name as the page heading; the difficulty and tag Badges; `"Recommended: {tempo} BPM · {formatDuration(duration)}"`; the description as plain text with line breaks kept (`whitespace-pre-line`).
  - A box with a dashed border and the text "Sheet coming soon".
  - A primary "Start" Button, always `disabled`.
  - Loading: a skeleton of the same layout. An `ApiClientError` with status `404` or `400` → `NotFound` "Lesson not found" with a link back to `/lessons` (Review Focus 5). Other errors → `QueryError`.
- [ ] **Step 2: Run** typecheck. In the browser: open a card from page 2 with a filter set, press "Back to library", and land on page 2 with the filter; reload the details page and press back again with the same result.
- [ ] **Step 3: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 4: Browser verification, skill, PRD and scope close

**Files:**
- Modify: `.claude/skills/local-dev/SKILL.md` (library flows), `docs/PRD.md` (ticks), `docs/specs/lessons-and-tags/spec.md` (status), `docs/specs/README.md` (index row)

- [ ] **Step 1: Run** `scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm typecheck && scripts/with-node.sh pnpm test && scripts/with-node.sh pnpm build`. Expected: all PASS.
- [ ] **Step 2: Drive the library flows** with the Playwright plugin on a freshly seeded DB, following spec §7 "UI verification": filters, sort, pagination, per-page change, refresh keeps state, skeletons visible on load (throttle the network or take a snapshot right after navigating), both empty states (the "no lessons" one after `pnpm db:reset`), details page back link, Start disabled, "Sheet coming soon", and a draft's details URL showing "Lesson not found".
- [ ] **Step 3: Check the Review Focus items:**
  - (1) open the garbage URL from Review Focus 1;
  - (2) select a tag, delete it in the DB (`docker compose exec` + `psql`, removing its `lesson_tags` first), reload, and see the URL lose the id with no extra history entry;
  - (3) type `?page=9` and see `page=2`; on page 2, change a filter and see `page=1`; filter to zero results with `page=3` in the URL and see the empty state;
  - (4) apply three filter changes, then go back twice and forward once, checking controls and results each time;
  - (5) open `/lessons/abc`, a random uuid, and a draft's id.
- [ ] **Step 4: Update the skill** with the library flows (numbered steps, expected results), next to the admin flows from plan 02.
- [ ] **Step 5: Close the scope.**
  - In `docs/PRD.md`, tick US-3, US-4, US-16, US-17a, US-18 and US-19, and add `lessons-and-tags` to the line that lists the scope behind each ticked story. Leave US-2, US-5, US-6 and US-17 unticked (spec §10).
  - Set this plan's status to `done` and tick its checkboxes.
  - Set the spec status to `implemented` once all three plans are `done`, and update the row in `docs/specs/README.md`.
  - List the ADRs created during execution (ADR-0037, plus any others) in the summary.
- [ ] **Step 6: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

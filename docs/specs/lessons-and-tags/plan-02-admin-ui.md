# Lessons and Tags — Plan 02: Admin UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
- **Status:** done

**Goal:** The shared web infrastructure for this scope (API client methods, `401` redirect, shadcn components, drummer and admin shells, pagination, tag picker) and the admin screens of spec §6.5: `/admin/lessons`, the lesson form, and `/admin/tags`.

**Architecture:** Server state lives in TanStack Query hooks per feature folder (`features/tags`, `features/admin-lessons`), always typed by contract schemas. List state for paginated admin screens lives in validated route search params. Pure logic (query string building, page items, duration stepping, search parsing) sits in small modules with Vitest unit tests; screens are verified in a real browser with the Playwright plugin (ADR-0027).

**Tech Stack:** React 19, TanStack Router / Query / Form, shadcn/ui (`radix-nova` style), Sonner, Vitest 5 (node environment, pure functions only).

**Spec:** [spec.md](spec.md) · **Depends on:** [plan-01-backend.md](plan-01-backend.md) done.

## Global Constraints

- [spec.md](spec.md) wins over this plan if they disagree. Raise the conflict instead of picking one silently.
- **Git:** each task ends with one commit to `main` containing exactly that task's files (the user allowed committing to `main` for the local MVP on 2026-10-25). Never branch, push, stash, rebase or reset. Commit messages: short imperative summary, no `Co-Authored-By` or any AI attribution.
- Run every `pnpm` command through `scripts/with-node.sh`.
- UI uses stock shadcn/ui components (added with `pnpm dlx shadcn@4.22.1 add …` in `apps/web`). Do not hand-roll a component shadcn provides. New npm dependencies pulled in by shadcn are pinned exactly in `apps/web/package.json` and recorded in ADR-0037 (Task 2). No other new dependencies, except `vitest` `5.0.5` (already used in the repo) as a dev dependency of `apps/web`.
- The frontend never computes `locked`, `lessonCount`, totals or filters itself; it renders what the API returns (CLAUDE.md, spec §2 anti-goals). If the API lacks something a screen needs, stop and report it as a backend gap.
- Mutation errors toast globally (ADR-0021) unless a step says otherwise; a `401` never toasts, it redirects to `/login`.
- While a mutation is pending, the control that started it (and the whole form, for forms) is disabled and shows a spinner (foundation pattern).
- Exact UI copy is quoted in the steps; text not quoted is the builder's choice, in English.
- Run `scripts/with-node.sh pnpm format` before closing each task.

## Review Focus

1. **Session lost mid-use** (e.g. `db:reset` while `/admin` is open). The next query or mutation must redirect to `/login` once, with no error toast and no retry loop. Unit-tested in Task 1, checked in the browser in Task 7.
2. **Double clicks on Save, Publish, Move to draft, Delete or Add tag.** Exactly one request must be sent. Checked in Task 7 (network requests).
3. **Fast typing in a tag search.** Results always match the latest text, never a slower earlier response. Query keys include the debounced `q`. Checked in Task 7.
4. **Infinite scroll at the end of the list.** With 1 page, exactly 20 tags, or 0 tags, scrolling to the bottom must not fire repeated requests. `nextPageParam` is unit-tested in Task 3.
5. **Lesson locked or deleted in another tab while its edit page is open.** Save must show the API message as a toast, then the page must switch to the locked Alert or "Lesson not found". Checked in Task 7.

---

### Task 1: API client methods, query strings, `401` redirect, web unit tests

**Files:**
- Modify: `apps/web/package.json` (devDependency `vitest` `5.0.5`, script `"test": "vitest run"`)
- Create: `apps/web/vitest.config.ts` (environment `node`, include `src/**/*.test.ts`, alias `@` → `src`)
- Modify: `apps/web/src/lib/api-client.ts`, `apps/web/src/lib/query-client.ts`, `apps/web/src/main.tsx`
- Test: `apps/web/src/lib/api-client.test.ts`, `apps/web/src/lib/query-client.test.ts`

**Interfaces:**
- Produces:
  - `apiRequest(path, { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; query?: QueryParams; body?; schema })` — the existing overloads, with the method union and `query` added.
  - `type QueryParams = Record<string, string | number | readonly string[] | undefined>`; `buildUrl(path: string, query?: QueryParams): string` — arrays become repeated keys, `undefined`, `""` and empty arrays are omitted, no `?` when nothing remains.
  - `createQueryClient(options: { onUnauthenticated: () => void }): QueryClient` — a `QueryCache` and the existing `MutationCache` both call `onUnauthenticated` for an `ApiClientError` with status `401` and skip the toast; this check runs before `meta.suppressErrorToast`. `main.tsx` passes a callback that clears the query cache and navigates to `/login`.

- [x] **Step 1: Write the failing tests**

```ts
// api-client.test.ts
expect(
  buildUrl("/api/lessons", {
    page: 2,
    tagIds: ["a", "b"],
    q: "",
    sort: undefined,
    difficulties: [],
  }),
).toBe("/api/lessons?page=2&tagIds=a&tagIds=b");
expect(buildUrl("/api/tags")).toBe("/api/tags");
expect(buildUrl("/api/tags", { q: "a b&c" })).toBe("/api/tags?q=a+b%26c");

// query-client.test.ts (vi.mock("sonner"))
it("401 from a mutation calls onUnauthenticated and does not toast", async () => {
  /* build a mutation that rejects with new ApiClientError(401, "UNAUTHENTICATED", "Not logged in"); expect spy called once, toast.error not called */
});
it("401 from a query calls onUnauthenticated", async () => {
  /* client.fetchQuery rejecting 401 → spy called once, no retry */
});
it("other mutation errors still toast with the API message", async () => {
  /* 409 → toast.error("…") */
});
it("suppressErrorToast suppresses the toast but not the 401 redirect", async () => {
  /* … */
});
```

- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/web test`. Expected: FAIL.
- [x] **Step 3: Implement** the interfaces above. `meQueryOptions` already turns its own `401` into `null`, so it never triggers the callback. Keep the existing retry rule (no retry on 4xx).
- [x] **Step 4: Run** the web tests and `scripts/with-node.sh pnpm typecheck`. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 2: shadcn components, ADR-0037, shells and shared UI pieces

**Files:**
- Create (shadcn CLI): `apps/web/src/components/ui/{alert,alert-dialog,badge,card,checkbox,command,dropdown-menu,empty,pagination,popover,radio-group,select,skeleton,slider,table,textarea,toggle-group,tooltip}.tsx`
- Create: `docs/adr/0037-<slug>.md` and its row in `docs/adr/README.md`; update `docs/TECH_STACK.md` if the UI row needs the new library named
- Move: `apps/web/src/routes/_authenticated/index.tsx` → `apps/web/src/routes/_authenticated/_app/index.tsx` (the placeholder stays until plan 03)
- Create: `apps/web/src/routes/_authenticated/_app.tsx` (drummer shell), `apps/web/src/routes/_authenticated/admin.tsx` (admin shell), `apps/web/src/routes/_authenticated/admin/index.tsx` (redirect to `/admin/lessons`)
- Create: `apps/web/src/components/query-error.tsx`, `components/not-found.tsx`, `components/pagination-bar.tsx`, `components/load-more-sentinel.tsx`, `lib/page-items.ts`, `hooks/use-debounced-value.ts`
- Test: `apps/web/src/lib/page-items.test.ts`

**Interfaces:**
- Produces:
  - `pageItems(page: number, totalPages: number): (number | "ellipsis")[]` — always page 1, the last page and `page ± 1`; a gap of exactly one page shows that page; a longer gap shows `"ellipsis"`.
  - `<PaginationBar page totalPages pageSize pageSizes={readonly number[]} onPageChange={(page) => void} onPageSizeChange={(size) => void} />` — shadcn Pagination (Previous / items / Next, disabled at the ends) plus a "Per page" Select. The page links are hidden when `totalPages ≤ 1`; the Select always shows.
  - `<QueryError error onRetry />` — shadcn Alert with the `ApiClientError` message (or "Something went wrong") and a "Try again" Button.
  - `<NotFound title backTo backLabel />` — e.g. "Lesson not found" with a link back.
  - `<LoadMoreSentinel onLoadMore={() => void} enabled={boolean} root?={Element | null} />` — an IntersectionObserver on an empty element; calls `onLoadMore` when visible and `enabled`.
  - `useDebouncedValue<T>(value: T, ms = 300): T`.
  - Drummer shell: header "Drum Tutor", "Library" link (to `/` until plan 03 changes it to `/lessons`), the user's email, "Log out" (the existing logout mutation, moved out of the placeholder page).
  - Admin shell: header "Drum Tutor · Admin" with a "Back to app" link to `/`, and a left nav with "Lessons" (`/admin/lessons`) and "Tags" (`/admin/tags`), the active item highlighted.

- [x] **Step 1: Write the failing test** `page-items.test.ts`:

```ts
expect(pageItems(1, 1)).toEqual([1]);
expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
expect(pageItems(1, 12)).toEqual([1, 2, "ellipsis", 12]);
expect(pageItems(4, 12)).toEqual([1, 2, 3, 4, 5, "ellipsis", 12]);
expect(pageItems(6, 12)).toEqual([1, "ellipsis", 5, 6, 7, "ellipsis", 12]);
expect(pageItems(12, 12)).toEqual([1, "ellipsis", 11, 12]);
expect(pageItems(1, 0)).toEqual([]);
```

- [x] **Step 2: Run** the web tests. Expected: FAIL.
- [x] **Step 3: Add the shadcn components** listed above. Pin every new dependency in `apps/web/package.json` exactly. Write **ADR-0037** (type `decision`) recording the libraries the components brought in that were not already in the repo (at least `cmdk` for Command), and add its index row. If the CLI adds anything else unexpected (e.g. a date or icon library), stop and report.
- [x] **Step 4: Implement** `pageItems`, the shared components and both shells. The admin shell may use the shadcn Sidebar or a simple nav made of stock components (spec §11).
- [x] **Step 5: Run** the web tests, `pnpm typecheck` and `pnpm build`. Start the app (`scripts/dev-start.sh`), log in, and check with the Playwright plugin: `/` shows the drummer shell and logout still works; `/admin` lands on `/admin/lessons` inside the admin shell (the page body can still be empty).
- [x] **Step 6: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 3: Tag queries and the tag picker

**Files:**
- Create: `apps/web/src/features/tags/tags.api.ts`, `features/tags/tag-picker.tsx`, `features/tags/selected-tags.tsx`
- Create: `apps/web/src/lib/infinite.ts`
- Test: `apps/web/src/lib/infinite.test.ts`

**Interfaces:**
- Consumes: `apiRequest` / `buildUrl` (Task 1), `LoadMoreSentinel`, `useDebouncedValue` (Task 2), contracts `TagSchema`, `AdminTagSchema`, `pageSchema`, `ApiPaths`.
- Produces:
  - `nextPageParam(last: { page: number; totalPages: number }): number | undefined` — `page + 1` while `page < totalPages`.
  - `tagKeys = { all: ["tags"], search: (q) => [...], byIds: (ids) => [...], admin: (q) => [...] }`.
  - `useTagSearch(q: string)` — `useInfiniteQuery` on `GET /api/tags`, `pageSize: 20`, `getNextPageParam: nextPageParam`.
  - `useTagsByIds(ids: readonly string[])` — one `GET /api/tags?ids=…&pageSize=100`, `enabled` only when `ids` is non-empty, returns `Tag[]`. This is the only way the UI resolves names of selected tags (ADR-0033).
  - `<TagPicker value={string[]} onChange={(ids) => void} disabled? invalid? />` — a trigger button reading "Tags" plus " (n)" when n > 0, and a Popover holding a Command with `shouldFilter={false}`. The input drives `q` (debounced 300 ms). Items show a checkbox state and toggle on select. A `LoadMoreSentinel` at the end of the list loads the next page. Empty result: "No tags found". Loading: skeleton rows.
  - `<SelectedTags ids={string[]} onRemove={(id) => void} disabled? />` — removable Badges for the resolved tags (from `useTagsByIds`), sorted as the API returns them.

- [x] **Step 1: Write the failing test** `infinite.test.ts`: `nextPageParam({ page: 1, totalPages: 2 })` → `2`; `{ page: 2, totalPages: 2 }` → `undefined`; `{ page: 1, totalPages: 0 }` → `undefined`.
- [x] **Step 2: Run** the web tests. Expected: FAIL.
- [x] **Step 3: Implement** the interfaces above.
- [x] **Step 4: Run** the web tests and typecheck. Expected: PASS. Picker behaviour is checked in the browser through the screens that use it (Tasks 6 and 7).
- [x] **Step 5: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 4: Admin tags screen

**Files:**
- Create: `apps/web/src/routes/_authenticated/admin/tags.tsx`
- Create: `apps/web/src/features/admin-tags/admin-tags-page.tsx`, `add-tag-form.tsx`, `tag-row.tsx`
- Modify: `apps/web/src/features/tags/tags.api.ts` (admin query and mutations)

**Interfaces:**
- Consumes: Task 3 `tagKeys`, `nextPageParam`; contracts `TagInputSchema`, `TagNameSchema`, `AdminTagSchema`, `ApiErrorCode`.
- Produces in `tags.api.ts`: `useAdminTags(q: string)` (infinite, `pageSize: 20`), `useCreateTag()`, `useRenameTag()`, `useDeleteTag()`. Each mutation invalidates `tagKeys.all` and shows the success toast "Tag added" / "Tag renamed" / "Tag deleted". Create and rename set `meta: { suppressErrorToast: true }` and toast every error except `TAG_NAME_TAKEN` themselves.

- [x] **Step 1: Implement the screen** per spec §6.5 "Tags":
  - "Add tag" form at the top (TanStack Form + `TagInputSchema`). On `409 TAG_NAME_TAKEN` the API message shows under the input, not as a toast. On success the input clears.
  - A search Input (debounced `q`) above a Table with columns Name, Used by (`"{n} lessons"`, `"1 lesson"`, or `"—"` for 0), and actions. A `LoadMoreSentinel` under the table loads more.
  - Rename inline: the pencil button swaps the name for an Input with Save / Cancel; Enter saves, Escape cancels; `TAG_NAME_TAKEN` shows under that input; an unchanged name closes without a request.
  - Delete: trash button disabled with Tooltip "Used by lessons" when `lessonCount > 0`; otherwise AlertDialog "Delete tag?" / `"{name}" will be deleted.` with "Cancel" / "Delete".
  - Empty states (shadcn Empty): "No tags yet" with no search, `No tags match "{q}"` with a search. Loading: skeleton rows. Query error: `QueryError`.
- [x] **Step 2: Verify in the browser** (Playwright plugin, seeded DB): add "Odd meters", add "odd METERS" → inline error, rename "Groove" → "Grooves" (Enter) and back, Escape cancels, search "hand" shows two rows, delete of a used tag is disabled with the tooltip, delete of "Odd meters" asks and removes it.
- [x] **Step 3: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 5: Admin lesson list

**Files:**
- Create: `apps/web/src/routes/_authenticated/admin/lessons/index.tsx`
- Create: `apps/web/src/features/admin-lessons/admin-lessons.api.ts`, `admin-lessons-search.ts`, `admin-lessons-table.tsx`, `lesson-row-actions.tsx`
- Create: `apps/web/src/features/lessons/format.ts` (`formatDifficulty`, `formatDate`)
- Test: `apps/web/src/features/admin-lessons/admin-lessons-search.test.ts`

**Interfaces:**
- Produces:
  - `adminLessonsSearchSchema` — `page` (int ≥ 1, `.catch(1)`), `pageSize` (20 | 50 | 100, `.catch(20)`); used as the route's `validateSearch`.
  - `lessonKeys = { all: ["lessons"], admin: { list: (search) => […], detail: (id) => […] }, library: … }` — plan 03 adds the library keys under the same root so admin mutations can invalidate library data.
  - `adminLessonsQueryOptions(search)`, `adminLessonQueryOptions(id)`; mutations `useCreateLesson()`, `useUpdateLesson(id)`, `useDeleteLesson()`, `usePublishLesson()`, `useUnpublishLesson()`, each invalidating `lessonKeys.all` and toasting "Lesson created" / "Lesson saved" / "Lesson deleted" / "Lesson published" / "Lesson moved to draft".
  - `formatDifficulty("beginner") === "Beginner"`; `formatDate(iso)` → `Intl.DateTimeFormat("en", { dateStyle: "medium" })`.

- [x] **Step 1: Write the failing test**: `{}` → `{ page: 1, pageSize: 20 }`; `{ page: 3, pageSize: 50 }` kept; `{ page: 0, pageSize: 7 }` and `{ page: "x" }` → defaults.
- [x] **Step 2: Run** the web tests. Expected: FAIL.
- [x] **Step 3: Implement the screen** per spec §6.5 "Lessons": header "Lessons" with a "New lesson" button; Table columns Name (+ lock icon with Tooltip "Has practice logs" when `locked`), Difficulty, Tags (first tag Badge + `"+N"` Badge), Status Badge ("Draft" / "Published"), Created, actions DropdownMenu (Edit; Publish for drafts or Move to draft for published; Delete with AlertDialog "Delete lesson?" / `"{name}" will be deleted. This can't be undone.`). For `locked` rows Edit, Move to draft and Delete render disabled. `PaginationBar` with `pageSizes [20, 50, 100]`; changing the page size resets `page` to 1. Skeleton rows while loading, `QueryError` on error, Empty "No lessons yet" with a "New lesson" button. If `page > totalPages > 0`, navigate (replace) to `totalPages`.
- [x] **Step 4: Run** the web tests, typecheck; in the browser (seeded): the 18 lessons fit on one page at 20, so page links are hidden and only "Per page" shows; the URL `?page=5` is replaced by `?page=1`; the locked lesson's actions are disabled, publish a draft and move it back, delete a draft after confirming.
- [x] **Step 5: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 6: Lesson form (create and edit)

**Files:**
- Create: `apps/web/src/features/lessons/duration.ts`
- Create: `apps/web/src/features/admin-lessons/lesson-form.tsx`, `tempo-field.tsx`, `duration-field.tsx`
- Create: `apps/web/src/routes/_authenticated/admin/lessons/new.tsx`, `apps/web/src/routes/_authenticated/admin/lessons/$lessonId.edit.tsx`
- Test: `apps/web/src/features/lessons/duration.test.ts`

**Interfaces:**
- Consumes: Task 3 `TagPicker`, `SelectedTags`; Task 5 api hooks; contracts `LessonInputSchema`, `TEMPO_BPM`, `DURATION_SECONDS`, `DIFFICULTIES`.
- Produces:
  - `duration.ts`: `formatDuration(seconds): string` (`"m:ss"`, e.g. `"5:00"`, `"0:30"`, `"60:00"`); `formatDurationClock(seconds): string` (`"MM:SS"`, e.g. `"03:00"`); `stepDuration(seconds: number, direction: 1 | -1): number` (±30, clamped to 30…3600). Plan 03 reuses `formatDuration`.
  - `type LessonFormValues = Omit<LessonInput, "difficulty"> & { difficulty: Difficulty | "" }`; `NEW_LESSON_DEFAULTS: LessonFormValues` = name `""`, description `""`, difficulty `""`, tagIds `[]`, tempo `60`, duration `180`.
  - `<LessonForm defaultValues disabled pending submitLabel onSubmit={(input: LessonInput) => void} onCancel />`.

- [x] **Step 1: Write the failing test** `duration.test.ts`: `formatDuration(300) === "5:00"`, `formatDuration(30) === "0:30"`, `formatDuration(3600) === "60:00"`; `formatDurationClock(180) === "03:00"`, `formatDurationClock(3600) === "60:00"`; `stepDuration(180, 1) === 210`, `stepDuration(30, -1) === 30`, `stepDuration(3600, 1) === 3600`.
- [x] **Step 2: Run** the web tests. Expected: FAIL.
- [x] **Step 3: Implement the form** per spec §6.5 "Lesson form": Name Input; Description Textarea; Difficulty RadioGroup (Beginner, Intermediate, Advanced; none selected on create); Tags via `TagPicker` + `SelectedTags`; Tempo = Slider 30–300 step 1 next to a number Input with the "BPM" suffix, kept in sync — typing sets the field to the typed number (empty → `NaN`, which fails the schema with "Tempo must be between 30 and 300 BPM"), the Slider shows the last valid value; Duration = read-only `MM:SS` text between "−" and "+" Buttons (`stepDuration`), "−" disabled at 30 s and "+" at 3600 s, **no typing**. Validation with `LessonInputSchema` on submit and on blur per field; errors under each field. While pending, all fields and buttons are disabled and Save shows a spinner.
- [x] **Step 4: Implement the routes.**
  - `/admin/lessons/new`: `NEW_LESSON_DEFAULTS`, Save → `useCreateLesson` → navigate to `/admin/lessons`.
  - `/admin/lessons/$lessonId/edit`: loads `adminLessonQueryOptions(id)`; `404` → `NotFound` "Lesson not found" back to `/admin/lessons`; other errors → `QueryError`. When `locked`, an Alert titled "This lesson is locked" with "Someone has already practiced it, so it can't be edited or deleted." sits above the form and the form is `disabled`. Save → `useUpdateLesson(id)` → navigate to `/admin/lessons`. On `409 LESSON_LOCKED` or `404` (global toast shows the message), refetch the lesson so the page switches state (Review Focus 5).
- [x] **Step 5: Run** the web tests and typecheck. Expected: PASS.
- [x] **Step 6: Checkpoint.** `pnpm format`. Commit the task's files to `main`.

### Task 7: Browser verification and skill update

**Files:**
- Modify: `.claude/skills/local-dev/SKILL.md` (add an "Admin flows" section under the e2e part, using the seed)

- [x] **Step 1: Run** `scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm typecheck && scripts/with-node.sh pnpm test && scripts/with-node.sh pnpm build`. Expected: all PASS.
- [x] **Step 2: Drive the admin flows** with the Playwright plugin on a freshly seeded DB (`pnpm db:seed`), logging in with a fresh `admin-<timestamp>@example.com`:
  - create a lesson: defaults show 60 BPM and 03:00; "−" pressed until 00:30 then disabled; "+" adds 30 s; typing 320 into BPM shows the tempo error; submitting empty shows the name, description, difficulty and tag errors; a valid save lands on the list with "Lesson created" and the new row as Draft;
  - edit that lesson, change tags and tempo, save; reopen and see the changes;
  - publish it, move it to draft, delete it with confirmation;
  - the seeded locked lesson: menu items disabled with the lock tooltip; typing its edit URL shows the locked Alert and a disabled form;
  - tag picker: search narrows results; scroll loads more (add tags through `/admin/tags` until there are more than 20, then scroll);
  - the tags screen flows from Task 4.
- [x] **Step 3: Check the Review Focus items** in the browser: double-click Save / Publish / Delete → one request each in `browser_network_requests` (2); type quickly in the picker and confirm the final list matches the final text (3); scroll the picker to the end with ≤ 20 tags → no further `/api/tags` requests (4); open an edit page, insert a practice log for that lesson in another way (e.g. `psql` through `docker compose exec`), press Save → toast, then the locked Alert (5); run `scripts/with-node.sh pnpm db:reset` with `/admin/lessons` open, click any action → one redirect to `/login`, no error toast (1).
- [x] **Step 4: Update the skill** with the admin flows above in the same style as the existing login flow (numbered steps, expected results).
- [x] **Step 5: Checkpoint.** `pnpm format`. Tick this plan's checkboxes and set its status to `done`. Commit the task's files to `main`.

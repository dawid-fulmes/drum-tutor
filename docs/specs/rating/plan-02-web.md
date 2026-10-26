# Rating — Plan 02: Web

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
- **Status:** done

**Goal:** Spec §7 and the web part of §8: rating on library cards, the **Highest rated** sort as the default, the rating row and the five-star modal on the lesson page, the unlock right after the first completed session, and ADR-0039 items 2 and 3 (pager stays mounted, tag picker capped at 20).

**Architecture:** A new `features/rating/` holds the pure formatting function, the mutation options and the modal. Cards and the lesson page only call the formatter and read `rating`, `myRating` and `canRate` from the API; nothing is derived on the client (ADR-0059). The save-log mutation additionally invalidates the logged lesson's detail query, which flips `canRate`. The rating mutation writes the response into the detail cache and invalidates the library lists. Pure logic is unit-tested; components are checked in the browser (no component-test setup, ADR-0027).

**Tech Stack:** React 19, TanStack Query/Router, shadcn `dialog`, `lucide-react` `Star`, Tailwind theme tokens, Vitest (node environment, pure functions and query options only). No new dependencies.

**Spec:** [spec.md](spec.md) · **Depends on:** [plan-01-backend.md](plan-01-backend.md) done.

## Global Constraints

- [spec.md](spec.md) wins over this plan if they disagree. Raise the conflict instead of picking one silently.
- **Git:** commit only when the user explicitly asks (their global rule). Each task ends with a checkpoint listing its files. If the user has asked for commits: to `main`, short imperative message, no AI attribution. Never branch, push, stash, rebase or reset.
- Run every `pnpm` command through `scripts/with-node.sh`. Run typecheck as `pnpm typecheck --force`.
- No new npm dependencies.
- Whether the drummer may rate comes only from `canRate`; the current rating only from `myRating` (ADR-0059). Never infer them from logs, stats or local state.
- Colours come from theme tokens (`text-foreground`, `text-muted-foreground`, `text-primary`, `fill-primary`), so stars work in light and dark mode.
- Failed mutations toast through the global handler (ADR-0021); no inline error UI for rating.
- Run `scripts/with-node.sh pnpm format` before closing each task.
- Any shortcut or `TODO` needs a tech-debt ADR, and the comment must read `// TODO(ADR-NNNN): …`.

**Exact copy**

| Where                                  | Text                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| summary, no ratings (card and page)    | `No ratings yet`                                                               |
| summary on a card                      | `★ 4.3 (12)`                                                                   |
| summary on the lesson page             | `★ 4.3 · 12 ratings` / `★ 5.0 · 1 rating`                                      |
| summary accessible text                | `Rated 4.3 out of 5 from 12 ratings` / `… from 1 rating`                       |
| sort options, in order                 | `Highest rated`, `Newest first`, `Oldest first`                                |
| rate button, no own rating             | `Rate this lesson`                                                             |
| rate button, own rating `n`            | `Your rating: n ★`, accessible name `Change your rating, currently n out of 5` |
| call to action when `canRate` is false | `Complete this lesson once to rate it.`                                        |
| modal title                            | `Rate <lesson name>`                                                           |
| star radio names                       | `1 star`, `2 stars`, … `5 stars`                                               |
| modal buttons                          | `Save`, `Cancel`                                                               |
| tag picker hint at the cap             | `You can select up to 20 tags`                                                 |

## Review Focus

1. **The rating button right after the first completed session.** The log save succeeds → the lesson detail is refetched → the button becomes active without a reload, while the practice panel keeps its `saved` state. Tested in Task 4 (`savePracticeLogOptions` invalidates the detail key of `input.lessonId`) and checked in the browser.
2. **A stale page whose `canRate` is true but the API answers `409 RATING_REQUIRES_COMPLETION`** (e.g. a reseeded database). Expected: the toast shows the API message, the modal stays open, the detail is invalidated so the button returns to disabled. Tested in Task 3 (mutation options invalidate the detail on that error code).
3. **Averages on the rounding edge** (`4.25` → `4.3`, `4.35`, `2.05`, `5`, `1`) and the singular `1 rating`. Expected: one decimal, round-half-up as shown, `5.0` not `5`. Tested in Task 1.
4. **Old library URLs and garbage `sort` values.** `/lessons` with no `sort`, `?sort=best` → the rating order and the Select showing **Highest rated**. `?sort=newest` still works. Tested in Task 2 (`librarySearchSchema`) and checked in the browser.
5. **Closing the modal without saving after changing the selection.** Expected: nothing is sent, and reopening shows the stored `myRating` again, not the abandoned choice. Checked in the browser in Task 3 (the selection state is reset on open).

---

### Task 1: Rating formatting

**Files:**

- Create: `apps/web/src/features/rating/format-rating.ts`
- Test: `apps/web/src/features/rating/format-rating.test.ts`

**Interfaces:**

- Consumes: `RatingSummary` from `@drum-tutor/contracts`.
- Produces: `formatRating(summary: RatingSummary, variant: "card" | "page"): { text: string; label: string }`. `text` is the visible string from the copy table; `label` the accessible text (`"No ratings yet"` for both when the count is 0). The average is formatted with one decimal, rounding half up. Round through integer hundredths (`Math.round(Math.round(average * 100) / 10) / 10`, then `toFixed(1)`), because `4.35 * 10` is `43.4999…` in floating point and a direct `Math.round(average * 10)` gives `4.3`.

- [x] **Step 1: Write the failing tests:** `{ average: null, count: 0 }` → `{ text: "No ratings yet", label: "No ratings yet" }` for both variants; `{ 4.33, 12 }` card → `"★ 4.3 (12)"`, page → `"★ 4.3 · 12 ratings"`, label `"Rated 4.3 out of 5 from 12 ratings"`; `{ 5, 1 }` page → `"★ 5.0 · 1 rating"`, label `"… from 1 rating"`; rounding (Review Focus 3): `4.25 → "4.3"`, `4.35 → "4.4"`, `2.05 → "2.1"`, `1 → "1.0"`.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/web test -- format-rating`. Expected: FAIL.
- [x] **Step 3: Implement** `formatRating`.
- [x] **Step 4: Run** the same command. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Files of this task: the files above.

### Task 2: Library: cards, sort default, pager and tag cap

**Files:**

- Modify: `apps/web/src/features/lessons/library-search.ts`, `apps/web/src/features/lessons/library-filters.tsx`, `apps/web/src/features/lessons/lesson-card.tsx`, `apps/web/src/features/lessons/lesson-card-skeleton.tsx`, `apps/web/src/features/lessons/library-page.tsx`, `apps/web/src/components/pagination-bar.tsx`, `apps/web/src/features/tags/tag-picker.tsx`, `apps/web/src/features/tags/tag-search-list.tsx`
- Test: `apps/web/src/features/lessons/library-search.test.ts`

**Interfaces:**

- Consumes: Task 1 `formatRating`; plan 01 `LessonSortSchema` with `"rating"`.
- Produces:
  - `librarySearchSchema.sort = LessonSortSchema.default("rating").catch("rating")`; `LIBRARY_MAX_TAGS = 20` exported from `library-search.ts`, used by the schema's `.max(LIBRARY_MAX_TAGS)` and by the picker.
  - `PaginationBar` gains `disabled?: boolean`: when true every page link and Previous/Next is `aria-disabled` with the existing disabled class and `tabIndex={-1}`, and the per-page `Select` is `disabled`. Default `false`, so the admin table is unchanged.
  - `TagPicker` gains `max?: number`; `TagSearchList` gains `canSelectMore: boolean` (default `true`). When `value.length >= max`, unselected options are disabled (`CommandItem disabled`) and the hint from the copy table shows under the input; selected options stay clickable so the drummer can deselect. The admin lesson form passes no `max` (its 10-tag rule stays a form validation).

- [x] **Step 1: Update the failing tests** in `library-search.test.ts`: both `toEqual` defaults use `sort: "rating"` (the garbage case `sort: "best"` falls back to `"rating"`); new case: `{ sort: "newest" }` stays `"newest"`; the 21-tag case uses `LIBRARY_MAX_TAGS + 1`.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/web test -- library-search`. Expected: FAIL.
- [x] **Step 3: Implement.**
  - Schema default and `LIBRARY_MAX_TAGS`.
  - Sort `Select`: items in the copy-table order with values `rating`, `newest`, `oldest`.
  - `LessonCard`: the rating line under the tempo/duration line, `formatRating(lesson.rating, "card")`; the visible text is `aria-hidden` and the `label` goes in a `sr-only` span. The card skeleton gains one more short line.
  - `LibraryPage`: render `PaginationBar` in the loading branch (`disabled`, `totalPages={0}` because no data is known yet, so only the disabled per-page Select shows; current `page`/`pageSize`) and in the empty-results branch (`disabled`), next to the skeleton and `LibraryEmpty`. Pass `max={LIBRARY_MAX_TAGS}` to the library `TagPicker` via `LibraryFilters`.
- [x] **Step 4: Run** the web tests and `scripts/with-node.sh pnpm typecheck --force`. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Files of this task: the files above.

### Task 3: Rating mutation and the five-star modal

**Files:**

- Create: `apps/web/src/features/rating/rating.api.ts`, `apps/web/src/features/rating/rating-dialog.tsx`, `apps/web/src/features/rating/star-rating-input.tsx`
- Test: `apps/web/src/features/rating/rating.api.test.ts`

**Interfaces:**

- Consumes: plan 01 `ApiPaths.lessonRating`, `RateLessonInput`, `LessonRatingSchema`, `LessonDetail`, `ApiErrorCode.RATING_REQUIRES_COMPLETION`; `lessonKeys` from `features/lessons/lesson-keys.ts`; `apiRequest`, `ApiClientError`.
- Produces:
  - `rateLessonOptions(queryClient: QueryClient, lessonId: string)` → mutation options with `mutationFn: (rating: number) => apiRequest(withId(ApiPaths.lessonRating, lessonId), { method: "PUT", body: { rating }, schema: LessonRatingSchema })`; `onSuccess(result)`: `setQueryData<LessonDetail>(lessonKeys.library.detail(lessonId), old => old && { ...old, rating: result.rating, myRating: result.myRating })` and `invalidateQueries({ queryKey: [...lessonKeys.all, "library", "list"] })`; `onError(error)`: when `error instanceof ApiClientError && error.code === RATING_REQUIRES_COMPLETION`, `invalidateQueries({ queryKey: lessonKeys.library.detail(lessonId) })`. No `meta`, so the global toast shows every failure.
  - `useRateLesson(lessonId: string)` = `useMutation(rateLessonOptions(useQueryClient(), lessonId))`.
  - `StarRatingInput({ value: number | null, onChange: (value: number) => void, disabled?: boolean })`: a `fieldset` with `role="radiogroup"` and an accessible name (`Rating`), five visually hidden native `input type="radio"` (shared `name` from `useId`) with `label`s holding a `Star` icon; the copy-table names; hover highlights stars `1…hovered` (`fill-primary text-primary`), otherwise `1…value`. Native radios give arrow-key movement and Space selection; the focused star gets the focus ring.
  - `RatingDialog({ lesson: LessonDetail, open: boolean, onOpenChange: (open: boolean) => void })`: shadcn `Dialog`, title from the copy table, `StarRatingInput`, **Cancel** (closes) and **Save** (disabled while nothing is selected or the mutation is pending). Selection state is reset to `lesson.myRating` every time `open` becomes true (Review Focus 5). On success it calls `onOpenChange(false)`; on error it stays open with the selection kept.

- [x] **Step 1: Write the failing tests** (`rating.api.test.ts`, same `MutationObserver` approach as `practice-logs.api.test.ts`, with a `QueryClient`, spies on `invalidateQueries`, and `mutationFn` overridden):
  - success with `{ rating: { average: 4.5, count: 2 }, myRating: 5 }` and a cached detail `{ …, rating: { average: 4, count: 1 }, myRating: null, canRate: true }` → the cached detail now has the new `rating` and `myRating: 5`, and `invalidateQueries` was called with `{ queryKey: ["lessons", "library", "list"] }`;
  - success with no cached detail → the cache stays empty (no partial object written);
  - rejection with `new ApiClientError(409, "RATING_REQUIRES_COMPLETION", "…")` → `invalidateQueries` called with the detail key (Review Focus 2); rejection with a `500` → the detail key is not invalidated.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/web test -- rating.api`. Expected: FAIL.
- [x] **Step 3: Implement** `rating.api.ts`, then `StarRatingInput` and `RatingDialog`.
- [x] **Step 4: Run** the web tests and `scripts/with-node.sh pnpm typecheck --force`. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Files of this task: the files above.

### Task 4: Lesson page row and the unlock after the first completion

**Files:**

- Create: `apps/web/src/features/rating/lesson-rating-row.tsx`
- Modify: `apps/web/src/features/lessons/lesson-details.tsx`, `apps/web/src/features/practice/practice-logs.api.ts`
- Test: `apps/web/src/features/practice/practice-logs.api.test.ts`
- Modify (docs): `.claude/skills/local-dev/SKILL.md` (new "Rating flows (e2e)" section and the updated library default), this plan (status, checkboxes, Execution notes), spec status and PRD (below), `docs/specs/README.md`, `docs/adr/0039-library-ui-known-gaps.md` (status line only), `docs/adr/0060-library-ui-gaps-after-rating-rework.md` (status line only), `docs/adr/README.md`

**Interfaces:**

- Consumes: Task 1 `formatRating`; Task 3 `RatingDialog`; `lessonKeys`.
- Produces:
  - `LessonRatingRow({ lesson: LessonDetail })`: the summary (`formatRating(lesson.rating, "page")`, visible text `aria-hidden`, label `sr-only`) and the action, per spec §7.3: `canRate === false` → disabled **Rate this lesson** plus the muted call to action; `canRate && myRating === null` → active **Rate this lesson**; `canRate && myRating === n` → **Your rating: n ★** with the copy-table accessible name. The button opens `RatingDialog`.
  - `savePracticeLogOptions(queryClient)` `onSuccess(_log, input)` also calls `invalidateQueries({ queryKey: lessonKeys.library.detail(input.lessonId) })`, next to the existing stats invalidation.

- [x] **Step 1: Write the failing test** in `practice-logs.api.test.ts`: a successful mutation (`mutationFn` resolving a log) with input `lessonId: L` calls `invalidateQueries` with `{ queryKey: ["lessons", "library", "detail", L] }` and still with the stats root key (Review Focus 1).
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/web test -- practice-logs`. Expected: FAIL.
- [x] **Step 3: Implement** the invalidation, `LessonRatingRow`, and place it in `LessonDetails` directly under the badges row; add a matching `Skeleton` row (`h-9 w-64`) to the details skeleton.
- [x] **Step 4: Run** `scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm typecheck --force && scripts/with-node.sh pnpm test`. Expected: all PASS.
- [x] **Step 5: Verify in the browser** (ADR-0027) with the `local-dev` skill and the Playwright plugin, after `scripts/with-node.sh pnpm db:seed`, logged in as `seed@example.com`:
  - `/lessons` opens with **Highest rated** selected; the first cards are Four on the floor `★ 4.7 (6)`, Money beat `★ 4.6 (5)`, Single strokes on a pad `★ 4.5 (6)`, Double strokes `★ 4.5 (2)`; the unrated tail shows `No ratings yet`; Newest first and back works; `?sort=best` shows the rating order;
  - Four on the floor: disabled button and `Complete this lesson once to rate it.`;
  - Weak hand eighth notes: `★ 3.3 · 3 ratings`, active **Rate this lesson** → modal with no star selected and **Save** disabled → keyboard: Tab into the group, arrows to 5, Save → modal closes, summary `★ 3.8 · 4 ratings`, button `Your rating: 5 ★`; back in the library its card shows `★ 3.8 (4)`, still between Disco offbeat hi-hat and Quarter-note kick control;
  - Money beat: button `Your rating: 5 ★` → modal opens with 5 selected; pick 2, **Cancel**, reopen → 5 is selected again (Review Focus 5); pick 3, Save → count stays 5, average `★ 4.2 · 5 ratings`, and in the library Money beat drops from 2nd to 4th, after Double strokes;
  - Inverted paradiddles (unrated, never completed): set duration to 0:30, Start, let it complete → without a reload the button becomes active → rate 4 → it shows `★ 4.0 · 1 rating` and in the library it leaves the unrated tail;
  - while the library page loads (throttle the network), the pager stays visible with disabled controls; with a filter that matches nothing it stays visible and disabled;
  - the library tag picker: after 20 selected tags (create extra tags in the admin if the seed has fewer), the other options are disabled with `You can select up to 20 tags`, and a selected one can still be removed; the admin lesson form's picker has no such hint;
  - dark mode: stars and the summary are readable.
  - Re-run `db:seed` afterwards.
- [x] **Step 6: Close the scope.**
  - `.claude/skills/local-dev/SKILL.md`: add a "Rating flows (e2e)" section with the flows above and note under "Library flows" that the default sort is Highest rated.
  - ADR-0039 status → `superseded by ADR-0060`; ADR-0060 status → `open`; update both rows in `docs/adr/README.md` (spec §10).
  - Spec status → `implemented`; `docs/specs/README.md` rating row: `implemented`, both plans `(done)`.
  - PRD (spec §11): tick US-2, US-5, US-6, US-12, US-13; add `rating` to the "delivering scope" sentence; drop the "rating still missing" note on US-6; in §4.5 add that a rating cannot be removed, only changed (ADR-0056), and that sorting by rating breaks ties by number of ratings (ADR-0057); in US-5 add that sorting by rating is the default (ADR-0058).
  - Tick this plan's checkboxes, set its status to `done`.
- [x] **Step 7: Checkpoint.** `pnpm format`. Files of this task: the files above.

## Execution notes

<!-- Filled in during execution: any decision taken while building. -->

- **Commits.** None made: the user's global rule requires an explicit ask before any commit, so all plan-02 changes are left uncommitted for the user.
- **Task 3.** Biome (`a11y/noNoninteractiveElementToInteractiveRole`) rejects `fieldset role="radiogroup"`, so the star group is a `div role="radiogroup" aria-label="Rating"` with the same semantics and no lint suppression.
- **Task 4.** The browser check found two focus bugs in the dialog (it has no `DialogTrigger`): focus opened on "1 star" even with a saved rating, and fell to `<body>` on close. The dialog now focuses the saved star on open and takes an optional `returnFocusRef` to return focus to the rate button. After a `409` the button is disabled, so focus cannot return to it.
- **Task 4, local check (2026-10-26).** Every Step 5 flow passed on the local app (port 5330) as `seed@example.com`, plus the stale-page `409` (toast, modal stays open, button turns disabled). Reseeded afterwards.
- **Final whole-scope review.** Ready to merge, no Critical or Important findings. One fix wave: Enter now selects a star (spec §7.4); the pager keeps the last known page links, disabled, while the next page loads (§7.6), and `go()` ignores clicks while disabled; the practice log save no longer waits for the lesson-detail refetch; added tests for `newest`/`oldest` over rated lessons and for the date tie-break; the `updated_at` check compares in SQL; the seed comment on locked lessons is updated.

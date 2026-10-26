# Rating — Spec

- **Status:** implemented
- **Date:** 2026-10-26
- **Related:** PRD §4.5, US-2, US-5, US-6, US-12, US-13; R3, R4, R11, R13; ADR-0010, ADR-0012, ADR-0021, ADR-0022, ADR-0027, ADR-0031, ADR-0039, ADR-0048, ADR-0055 – ADR-0060
- **Plans:** [plan-01-backend.md](plan-01-backend.md), [plan-02-web.md](plan-02-web.md)

## 1. Intent

This is the fifth and last MVP scope. A drummer who has played a lesson to the end at least once can give it 1–5 stars. Everyone sees each lesson's average and number of ratings. The library is sorted by rating by default, so the lessons drummers like best come first.

Three things come out of it:

- **Lesson page:** a rating summary (`★ 4.3 · 12 ratings` or `No ratings yet`) and a **Rate this lesson** button. Until the drummer has completed the lesson once, the button is disabled and a short call to action sits next to it. The first completed log unlocks the button on the spot, with no page reload. The button opens a **modal with five stars**. The drummer picks one and saves. Later the same button opens the modal with their current rating selected, so they can change it.
- **Library:** every card shows the average and the count. There is a new sort option, **Highest rated**, and it is the **default**. Lessons without ratings come last.
- **Storage built for sorting:** ratings live in their own table, the single source of truth. Each lesson also stores its rating count and average, recomputed from that table every time a rating is written. This way the library can sort by rating through an index, without aggregating every rating on every page load (§5, ADR-0055).

The path from the previous scopes applies unchanged: Zod contract in `packages/contracts` → Fastify route validated by it → Drizzle schema and migration → TanStack Query in the SPA → integration tests on real PostgreSQL.

## 2. Goals, non-goals, anti-goals

**Goals**

- A drummer with at least one practice log of a lesson can rate it 1–5 and change the rating later (R3, R4, US-13).
- A drummer without a log sees the control disabled, with a call to action (US-12). The backend enforces the rule, not only the UI.
- The lesson page and every library card show the average rating and the number of ratings (US-2, US-6).
- The library can be sorted by average rating, which is the default sort. Unrated lessons come last (US-5, ADR-0012, ADR-0057, ADR-0058).
- A page sorted by rating costs the same as a page sorted by date: the cost does not grow with the number of ratings.
- Two library gaps from ADR-0039 are repaid: the pager stays mounted while loading, and the tag picker stops at 20 tags (§7.5).

**Non-goals (this scope)**

- Removing a rating. A rating can only be changed to another value (ADR-0056).
- Reviews, comments, or any text next to a rating (PRD non-goal: no social features beyond rating).
- A weighted ranking (Bayesian average, minimum number of ratings). The sort uses the plain average the PRD names (ADR-0057).
- Half stars, or ratings outside the integers 1–5.
- Showing the drummer's own rating on library cards, or filtering the library by rating.
- Rating in the admin UI. The admin list contract inherits the rating fields (§6.1), but nothing new is shown there.
- Prompting for a rating automatically after a completed session (ADR-0010).
- A committed Playwright suite (ADR-0027 stays open).

**Anti-goals** — the scope fails if any of these happen, even if it "works"

- A rating is stored for a user without a practice log of that lesson, through any path, including concurrent requests and the seed.
- A lesson's stored count or average differs from what its ratings in `lesson_ratings` give, after any sequence of rating writes, concurrent ones included.
- The library query sorted by rating aggregates `lesson_ratings`, so its cost grows with the total number of ratings.
- The web app decides whether a drummer may rate by looking at logs or other client-side data, instead of the `canRate` field from the API.
- A lesson without ratings shows `0.0`, `0 stars` or an empty star row instead of "No ratings yet".
- The rating button stays disabled after the first completed log until the page is reloaded.

## 3. Constraints

- Everything in [TECH_STACK.md](../../TECH_STACK.md) and the accepted ADRs applies, plus the patterns from the earlier scopes: error shape (ADR-0022), global mutation error toasts (ADR-0021), thin fetch client (ADR-0025), integration tests on real PostgreSQL (ADR-0018), UI verified with the Playwright plugin (ADR-0027).
- The modal uses the stock shadcn `dialog` already in `apps/web/src/components/ui`. No new runtime dependency is needed for this scope.
- Code, docs, UI text and test data in English.

## 4. Rules

| #   | Rule                                                                                                                                                                                            | Source             |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | A rating is an integer 1–5.                                                                                                                                                                     | PRD §4.5           |
| 2   | A user may rate a lesson only if they have at least one practice log of it. Checked by the backend on every write.                                                                              | R3, ADR-0010       |
| 3   | One rating per user per lesson. Writing again replaces the value.                                                                                                                               | R4, ADR-0010       |
| 4   | A rating cannot be removed.                                                                                                                                                                     | ADR-0056           |
| 5   | Only published lessons can be rated. A lesson with logs cannot go back to draft (R11), so a rated lesson is always published.                                                                   | R11                |
| 6   | Displayed rating = average of all users' ratings + number of ratings. A lesson with no ratings has no average.                                                                                  | PRD §4.5           |
| 7   | Sorting by rating: average descending; equal averages → more ratings first; then newest first (`created_at` desc, `id` desc). Unrated lessons come last, ordered newest first among themselves. | ADR-0012, ADR-0057 |
| 8   | The library's default sort is rating (rule 7).                                                                                                                                                  | ADR-0058           |

## 5. Data model (`packages/db`)

The full reasoning, with the measurements, is in ADR-0055. In short:

| Measured on local PostgreSQL 18, skewed popularity   | Aggregate ratings on read | Stored count and average + index |
| ---------------------------------------------------- | ------------------------- | -------------------------------- |
| 1,000 lessons, ~560k ratings, page 1                 | ~30 ms                    | < 0.1 ms                         |
| 5,000 lessons, ~5.6M ratings, page 1                 | ~300 ms                   | < 0.1 ms                         |
| same, with a two-tag filter                          | ~280 ms                   | ~0.6 ms                          |
| Recompute one lesson on write: median / 145k ratings | —                         | ~0.5 ms / ~20 ms                 |

### 5.1 Migration

One migration:

| Change                                                                                                                                                                                                                                   | Why                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| new table `lesson_ratings`: `lesson_id uuid` → `lessons.id` (on delete **restrict**), `user_id uuid` → `users.id` (on delete **cascade**), `rating smallint not null`, `created_at`, `updated_at` (`timestamptz not null default now()`) | The single source of truth for ratings.                                                                   |
| primary key `(lesson_id, user_id)`                                                                                                                                                                                                       | One rating per user per lesson (R4). The recompute reads one lesson's ratings through this key.           |
| check `rating between 1 and 5`                                                                                                                                                                                                           | Backstop for rule 1.                                                                                      |
| add to `lessons`: `rating_count integer not null default 0`, `rating_avg numeric(3,2)` (nullable)                                                                                                                                        | The stored aggregate that the library reads and sorts by.                                                 |
| check on `lessons`: `(rating_count = 0) = (rating_avg is null)` and `rating_avg between 1 and 5`                                                                                                                                         | A lesson either has no ratings and no average, or both.                                                   |
| index `lessons_status_rating_idx` on `lessons (status, rating_avg desc nulls last, rating_count desc, created_at desc, id desc)`                                                                                                         | The library page sorted by rating (rule 7) reads its rows in index order and stops after `pageSize` rows. |
- `rating_avg` is the average rounded to two decimals (`round(avg(rating), 2)`). Sorting uses the stored value, so two averages that round to the same two decimals count as equal.
- Existing lessons get `rating_count = 0` and `rating_avg = null`, which is correct because no ratings exist yet.
- The existing `lessons_status_created_at_id_idx` stays for the newest and oldest sorts.
- **The R3 rule has no database backstop.** It depends on another table (`practice_logs`), and a check constraint cannot express that. The API checks it inside the write transaction (§6.3). Practice logs are never deleted while their lesson exists (R7, `restrict`), so a rating never loses its log afterwards.
- **User deletion.** `lesson_ratings.user_id` cascades like `practice_logs.user_id`. No code path deletes users in the MVP (ADR-0001, ADR-0004). Any future path that deletes ratings outside the rating endpoint must recompute the affected lessons (ADR-0055).

### 5.2 Recomputing the aggregate

`rating_count` and `rating_avg` are written **only** by one recompute function. It lives in `packages/db`, so both the API's rating endpoint and the seed call the same code. It recomputes one lesson from scratch, inside the caller's transaction:

```sql
update lessons
set rating_count = s.count, rating_avg = s.avg
from (
  select count(*)::int as count, round(avg(rating), 2) as avg
  from lesson_ratings where lesson_id = $1
) s
where lessons.id = $1
```

It always recomputes the whole lesson and never adds or subtracts a delta, so an error cannot pile up over time.

### 5.3 Seed

`pnpm db:seed` keeps everything from the previous scopes. It also gets ratings that are believable and exercise every state:

- **Rater users:** a handful of extra users (e.g. `rater1@example.com` … `rater8@example.com`), upserted by email like the seed user. Each rater gets a short practice history (at least one log) on every lesson they rate, so R3 holds in the seed data too.
- **Rated lessons:** the three lessons the seed user practises (1, 2, 5 in the signature spec §5.1) plus about five other published lessons. The other published lessons stay unrated, so "No ratings yet" and "unrated last" can be seen.
- **Seed user:** rates lessons 1 and 2 but **not** 5. Locally you can see all three states: lesson 5 is completed but not rated (button active, no own rating), lessons 1 and 2 are rated (button shows the own rating), and the other lessons are not completed (button disabled).
- **Values:** chosen so the order under rule 7 is visible: at least one pair of lessons with the same average but different counts, and at least one lesson with a single rating.
- The seed deletes `lesson_ratings` before `practice_logs`, writes the ratings, and then runs the recompute from §5.2 for every lesson it rated.
- Lessons that get logs become locked (R7). Locally that means about eight locked lessons instead of three. The drafts and the other unrated published lessons stay editable for admin testing.

## 6. API contract

### 6.1 Shapes (`packages/contracts`)

```ts
RatingValueSchema = z.number().int().min(1).max(5); // message: "Choose a rating from 1 to 5"

RatingSummarySchema = z.object({
  average: z.number().min(1).max(5).nullable(), // two decimals; null exactly when count = 0
  count: z.number().int().min(0),
});

LessonSummary += { rating: RatingSummary }; // library list, drummer detail, admin list and detail (inherited)

// Today AdminLessonSchema = LessonDetailSchema.extend(adminFields). Split the detail so the
// per-user fields stay off the admin shapes:
LessonContentSchema = LessonSummarySchema.extend({ description, signature }); // shared base
LessonDetailSchema = LessonContentSchema.extend({
  myRating: RatingValue | null, // the current user's rating
  canRate: boolean, // the current user has ≥ 1 log of this lesson (R3)
});
AdminLessonSchema = LessonContentSchema.extend(adminFields);

LessonSort = z.enum(["rating", "newest", "oldest"]); // LibraryQuery.sort default: "rating"

RateLessonInputSchema = z.object({ rating: RatingValueSchema });
LessonRatingSchema = z.object({ rating: RatingSummary, myRating: RatingValue });
```

- `AdminLessonSummary` (from `LessonSummary`) and `AdminLesson` (from `LessonContent`) gain `rating` too. The name `LessonContent` is the builder's choice. The admin repository fills it from the same columns. The admin UI ignores it (§2).
- `myRating` and `canRate` are on `LessonDetail` only. They are not on the list and not in the admin shapes.
- New path: `ApiPaths.lessonRating = "/api/lessons/:id/rating"`.
- New error code: `RATING_REQUIRES_COMPLETION` (`409`), message "Complete this lesson once before rating it".

### 6.2 Reads

| Operation              | Change                                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/lessons`     | Every item carries `rating` from `lessons.rating_count` / `rating_avg`. `sort=rating` orders by rule 7 through `lessons_status_rating_idx`. A missing `sort` means `rating`. The total count query is unchanged. |
| `GET /api/lessons/:id` | Adds `rating`, `myRating` (primary key lookup in `lesson_ratings`) and `canRate` (whether the user has any `practice_logs` row for the lesson). No aggregation over ratings.                                     |
| Admin list and detail  | Add `rating` from the same columns.                                                                                                                                                                              |

The rating-sorted library query must not join or aggregate `lesson_ratings`. An integration test checks that sorting and pagination match rule 7 (§8). The cost guarantee comes from the design, because the query reads only `lessons`.

### 6.3 `PUT /api/lessons/:id/rating`

Creates or replaces the current user's rating. The body is `RateLessonInput`. It answers `200 LessonRating`. Behind `requireUser` like the other drummer routes.

All of it runs in one transaction, in this order:

1. `select … from lessons where id = $1 and status = 'published' for update`. No row → `404 NOT_FOUND` "Lesson not found". **Taking the row lock first is required:** it makes concurrent writes for the same lesson run one after another. Without it, two transactions can each recompute from a snapshot that misses the other's rating, and the stored count drifts (ADR-0055).
2. Check that a `practice_logs` row exists for `(user, lesson)`. None → `409 RATING_REQUIRES_COMPLETION`, nothing written.
3. Upsert into `lesson_ratings` on `(lesson_id, user_id)`: insert, or set `rating` and `updated_at = now()`.
4. Recompute the lesson (§5.2), returning `rating_count` and `rating_avg`.
5. Respond with `{ rating: { average, count }, myRating }`.

- An invalid body → `400 VALIDATION_ERROR` (ADR-0022). An invalid id → `400`, as on `GET /api/lessons/:id`.
- Writing the same value again is allowed. It answers `200`, and the result is unchanged except `updated_at`.
- There is no `DELETE` (ADR-0056).
- `rating_avg` is a `numeric` column, which Drizzle returns as a string. The repository turns it into a number, so the contract carries numbers.

## 7. Web app (`apps/web`)

### 7.1 Formatting

One small pure function formats a `RatingSummary`, with unit tests:

- `count = 0` → "No ratings yet".
- Otherwise the average to one decimal plus the count: on cards `★ 4.3 (12)`, on the lesson page `★ 4.3 · 12 ratings` / `★ 5.0 · 1 rating`.
- The star is decorative. The accessible text reads "Rated 4.3 out of 5 from 12 ratings".

### 7.2 Library

- `LessonCard` shows the rating line next to the tempo and duration line.
- The sort Select lists **Highest rated** (`rating`), **Newest first**, **Oldest first**, in that order.
- `librarySearchSchema.sort` defaults to `rating` and falls back to `rating` on unknown values. The library URL without `sort` therefore shows the rating order. This is the same as the API default, and both are stated explicitly instead of relying on each other.

### 7.3 Lesson page

- Under the badges, one row holds the rating summary (§7.1) and the rating action:
  - `canRate = false`: a disabled **Rate this lesson** button and the muted text "Complete this lesson once to rate it." (US-12).
  - `canRate = true`, `myRating = null`: an active **Rate this lesson** button.
  - `canRate = true`, `myRating = n`: the button reads **Your rating: n ★** (accessible name "Change your rating, currently n out of 5") and opens the same modal.
- The details skeleton gets a placeholder for this row.

### 7.4 Rating modal

- A shadcn `Dialog` titled "Rate <lesson name>", with five star controls in a row, **Save** and **Cancel**.
- The stars behave as one single-choice group: role `radiogroup`, each star a `radio` named "1 star" … "5 stars". Arrow keys move the selection and Enter or Space selects. Hovering over a star highlights it and every star before it. The selected value stays filled when the pointer leaves.
- The current `myRating` is selected when the modal opens. If there is none, nothing is selected and **Save** is disabled until a star is picked.
- **Save** sends `PUT /api/lessons/:id/rating` and disables itself while the request runs. On success the modal closes, the lesson detail query is updated from the response or invalidated, and the library queries are invalidated, so cards and the rating order are fresh. On failure the global toast shows the API message (ADR-0021) and the modal stays open with the selection kept.
- A `409 RATING_REQUIRES_COMPLETION` can only come from a stale page. It is handled like any other error (toast), and the lesson detail is invalidated so the button returns to the disabled state.

### 7.5 Unlocking after the first completion

- `savePracticeLogOptions.onSuccess` also invalidates the lesson detail query of the logged lesson, next to the stats it already invalidates. `canRate` then becomes `true` from the API, and the button becomes active without a reload (US-12 → US-13).
- The practice panel itself does not change.

### 7.6 ADR-0039 items repaid here

- **Item 2:** the `PaginationBar` stays mounted while a page loads and on empty results. Its controls are disabled in those states instead of the bar disappearing.
- **Item 3:** the library `TagPicker` stops accepting selections at 20 tags, matching the URL schema cap. The remaining options are disabled with a hint.
- Items 1 (loading announcements) and 4 (component tests) keep their own triggers and move to ADR-0060.

## 8. Tests

**Contract unit tests:** `RatingValueSchema` accepts 1 and 5 and rejects 0, 6 and 3.5. `RatingSummarySchema` accepts `{ average: null, count: 0 }`. `LibraryQuerySchema` defaults `sort` to `rating` and accepts `newest` and `oldest`. `RateLessonInputSchema` requires `rating`.

**API integration tests** (ADR-0018):

- `PUT` rating without a log → `409 RATING_REQUIRES_COMPLETION`, nothing stored, lesson aggregate unchanged.
- `PUT` with a log → `200`, `myRating` and `rating` returned, the detail shows them, `canRate` is true.
- `PUT` again with another value → `200`, still one row, count unchanged, average updated.
- `PUT` on a draft or a missing lesson → `404`. Invalid body → `400`.
- **Concurrency:** N users (e.g. 20) rate the same lesson in parallel → `rating_count = N` and `rating_avg` equals the rounded average of the stored rows. One user sending two different values in parallel → one row, and the aggregate matches it.
- **Consistency helper:** after each write test, the stored `rating_count` / `rating_avg` equal the values recomputed from `lesson_ratings`.
- Library `sort=rating` (and with no `sort`): order follows rule 7, including the tie on average broken by count, then by date, and unrated lessons last. Pagination across the rated/unrated boundary has no duplicates or gaps. Filters combine with the rating sort.
- Detail for a user without a log: `canRate = false`, `myRating = null`. Admin list items carry `rating`.

**Seed test:** every seeded rating has a log of the same user and lesson; every lesson's stored aggregate equals the recompute; the seed user's rated and unrated lessons are as in §5.3.

**Web unit tests** (pure functions only): rating formatting (§7.1) for 0, 1 and many ratings and the one-decimal rounding; `librarySearchSchema` defaulting `sort` to `rating`.

**UI verification** (ADR-0027) through the `local-dev` skill and the Playwright plugin, after `db:seed`:

- library opens sorted by **Highest rated**: rated lessons first in rule-7 order, unrated last with "No ratings yet"; switching to Newest first and back works;
- a lesson never completed: disabled button with the call to action;
- lesson 5 (completed, unrated): rate 4 in the modal → summary and button update, library order updates;
- lesson 1: the button shows the own rating; changing it keeps the count and changes the average;
- an unrated, never-completed lesson: complete one short session (30 s) → the button becomes active without a reload → rate it → the lesson leaves the unrated tail of the library;
- the pager stays visible (disabled) while a page loads; the tag picker stops at 20 selections.

The `local-dev` skill's e2e section is updated with these flows.

## 9. Plans

- **`plan-01-backend.md`:** contract shapes, migration, the rating endpoint with the locked upsert-and-recompute, the rating sort and default, detail and admin read changes, seed ratings, contract, integration, concurrency and seed tests. Verifiable through tests and `/api/docs`.
- **`plan-02-web.md`:** rating formatting, cards and sort option with the new default, the lesson page row, the modal, the unlock after the first completion, the two ADR-0039 items. Verifiable in the browser against the seed.

Plan 02 depends on plan 01.

## 10. Decisions recorded with this scope

| ADR                                                                          | Decision                                                                                                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [ADR-0055](../../adr/0055-ratings-table-with-stored-aggregate-on-lessons.md) | Store ratings in their own table and keep each lesson's count and average on `lessons`, recomputed under a row lock on every rating write              |
| [ADR-0056](../../adr/0056-ratings-can-be-changed-not-removed.md)             | A rating can be changed but not removed                                                                                                                |
| [ADR-0057](../../adr/0057-rank-by-plain-average-ties-by-count.md)            | Rank by plain average rating; equal averages by number of ratings, then newest                                                                         |
| [ADR-0058](../../adr/0058-library-sorted-by-rating-by-default.md)            | The library is sorted by rating by default                                                                                                             |
| [ADR-0059](../../adr/0059-rating-api-contract.md)                            | Rating contract: summary on every lesson, `myRating` and `canRate` on the detail, `PUT` upsert, `409 RATING_REQUIRES_COMPLETION` (supersedes ADR-0031) |
| [ADR-0060](../../adr/0060-library-ui-gaps-after-rating-rework.md)            | Remaining library UI gaps after the rating rework (tech-debt; supersedes ADR-0039)                                                                     |

When the spec is approved, ADR-0055 – ADR-0059 move from `proposed` to `accepted` and ADR-0031 becomes `superseded by ADR-0059`. ADR-0060 becomes `open` and ADR-0039 becomes `superseded by ADR-0060` when plan 02 is done, because items 2 and 3 are fixed there. Both indexes (`docs/adr/README.md`, `docs/specs/README.md`) are updated in the same changes.

## 11. PRD tracking

When all plans are done:

- tick **US-2, US-5, US-6, US-12, US-13** with `rating` as the delivering scope, and drop the "rating still missing" note on US-6;
- in §4.5, add that a rating cannot be removed, only changed (ADR-0056), and that sorting by rating breaks ties by number of ratings (ADR-0057);
- in US-5, add that sorting by rating is the default (ADR-0058).

## 12. Left to the builder

- Exact look of the stars (icon source among what the app already has, size, colours from the theme tokens), of the summary row and of the disabled state, as long as §7.3 and §7.4 hold.
- Whether the star group is built on the stock `radio-group` / `toggle-group` component or plain inputs, as long as the keyboard and ARIA behaviour in §7.4 holds.
- Whether a successful save writes the response into the detail query cache or just invalidates it.
- The exact seed rater count, rated lessons and values, within §5.3.
- Module layout (e.g. `features/rating/` for the modal, formatting and API hooks; `modules/lessons/rating.repository.ts` in the API).

## 13. Claude's calls

- The rating control is a button on the lesson page that opens a modal. The modal never opens by itself (product owner, consistent with ADR-0010).
- The button shows the drummer's current rating once they have one.
- `canRate` and `myRating` come from the API. The frontend never derives them.
- Rating a draft or a missing lesson is a `404`, like logging one.
- Breaking R3 is a `409` with its own code, like the other business rule conflicts (`LESSON_LOCKED`, `SIGNATURE_EMPTY`).
- The average is stored to two decimals, and the UI shows one decimal.
- Equal averages are ordered by count, then newest. Unrated lessons come newest first among themselves.
- The admin shapes inherit `rating`, but the admin UI does not show it in this scope.
- No query-plan or timing test for the rating sort: the query reads only `lessons` through an index, so its cost cannot grow with ratings. The concurrency and consistency tests guard what can actually break.
- The seed adds rater users with their own logs, which locks about five more lessons locally.
- ADR-0039 items 2 and 3 are repaid here, because their trigger is this rework. Items 1 and 4 carry over.

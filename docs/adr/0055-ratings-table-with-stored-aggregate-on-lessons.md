# ADR-0055: Store ratings in their own table and keep each lesson's count and average on `lessons`, recomputed under a row lock on every rating write

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-26
- **Related:** PRD §4.5, US-2, US-5, US-6; R3, R4, R13; ADR-0010, ADR-0012, ADR-0048, ADR-0057, ADR-0058; specs/rating

## Context

Every library item shows its lesson's average rating and number of ratings, and the library is sorted by average rating by default (ADR-0058). The list is paginated on the server with filters and sorting applied to the whole set (R13). One page sorted by rating therefore needs every lesson's average to be known before the first 20 can be picked.

ADR-0048 computes stats on read. That works because a stats query reads one user's logs. A rating sort reads everyone's ratings.

We measured both options on the local PostgreSQL 18, with skewed lesson popularity (a few hits and a long tail):

| Scenario                                     | Aggregate ratings on read | Stored count and average + index |
| -------------------------------------------- | ------------------------- | -------------------------------- |
| 1,000 lessons, ~560k ratings, page 1         | ~30 ms                    | < 0.1 ms                         |
| 5,000 lessons, ~5.6M ratings, page 1         | ~300 ms                   | < 0.1 ms                         |
| same, with a two-tag filter                  | ~280 ms                   | ~0.6 ms                          |
| same, page at offset 2000                    | —                         | ~0.3 ms                          |
| Recompute one lesson on write: median lesson | —                         | ~0.5 ms                          |
| Recompute one lesson on write: 145k ratings  | —                         | ~20 ms                           |

Aggregating on read grows linearly with the total number of ratings and cannot use an index for the order, because the sort key is computed. Rating writes are rare compared to library reads.

## Decision

- **`lesson_ratings (lesson_id, user_id, rating, created_at, updated_at)`**, primary key `(lesson_id, user_id)`, `rating` checked to 1–5. This table is the single source of truth.
- **`lessons.rating_count integer not null default 0` and `lessons.rating_avg numeric(3,2)`** (null exactly when the count is 0) hold the aggregate. An index `(status, rating_avg desc nulls last, rating_count desc, created_at desc, id desc)` serves the rating-sorted library.
- **Every rating write runs in one transaction:** lock the lesson row (`select … for update`), check the R3 precondition, upsert the rating, then **recompute the lesson's count and average from `lesson_ratings`** and store them.
- The lock comes first on purpose. Under READ COMMITTED, two concurrent writers that recompute without it can each read a snapshot that misses the other's new rating, and the second one to commit overwrites the first one's count. With the lock, the second writer's recompute statement starts after the first one has committed, so it sees both ratings.
- The aggregate columns are written only by that one recompute function (used by the API and the seed). An integration test runs concurrent ratings and checks that the stored aggregate equals the recompute.

## Alternatives considered

- **Aggregate on read (join a `group by lesson_id` subquery and sort by it)** — rejected: ~300 ms per page at 5.6M ratings and growing linearly, with no index able to help, and on the default view of the app.
- **Increment and decrement deltas (`rating_count + 1`, `rating_sum + new - old`)** — rejected: concurrency-safe on its own, but it needs the old value read under a lock anyway, and any bug or out-of-band change leaves a drift that never corrects itself. Recomputing from the source heals on the next write and costs at most a few milliseconds.
- **A database trigger on `lesson_ratings`** — rejected: the same race exists inside the trigger unless it locks the lesson row too, and it hides business logic in SQL migrations that the rest of the codebase keeps in TypeScript.
- **A materialized view of averages, refreshed periodically** — rejected: a drummer's own rating would not show up in the order or the average right after saving it.
- **A separate `lesson_rating_stats` table** — rejected: the library filters by `lessons.status` and sorts by rating. Keeping both on `lessons` lets one index serve the filter and the order without a join.
- **A weighted average stored instead of the plain one** — out of scope here, see ADR-0057.

## Consequences

- The library sorted by rating costs the same as sorted by date, whatever the number of ratings.
- A rating write takes a row lock on its lesson, so concurrent ratings of one lesson are serialized. At MVP volume this cannot be noticed. A very popular lesson could become a hot row much later; revisit if rating writes on one lesson ever queue for long.
- `rating_avg` is `numeric`, which Drizzle returns as a string, so the repository converts it to a number.
- **Must stay true:** nothing writes `rating_count` / `rating_avg` except the recompute, and anything that deletes or changes ratings outside the rating endpoint (e.g. a future user deletion cascading through `lesson_ratings.user_id`) must recompute the affected lessons.
- R3 has no database backstop. It is checked inside the locked write transaction. Logs of a lesson are never deleted while it exists (R7), so a rating cannot lose its log afterwards.

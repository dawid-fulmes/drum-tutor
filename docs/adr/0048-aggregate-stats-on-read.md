# ADR-0048: Aggregate stats on read from practice logs, without a snapshot table

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD US-14, US-15, R6, R7, R12, anti-goal "historical statistics silently change"; ADR-0006, ADR-0007, ADR-0043; specs/practice-and-stats

## Context

Stats show one user's practice time for one tag, per day (week and month views) or per week (year view). A busy drummer may log around 20 sessions a day, which is about 600 logs a month and 7,300 a year. A pre-aggregated table of daily volume per user and tag would make reads proportional to the number of days instead of the number of logs.

## Decision

Stats are computed on read with one SQL query per request over `practice_logs`. The query filters by user and `local_date` range, joins `lesson_tags` on the lesson and the chosen tag, groups by day or week, and left-joins a series generated in the database. `practice_logs` gets an index on `(user_id, local_date) include (lesson_id, duration_seconds)` so the range is read from the index alone. An integration test guards the cost: a year of weekly stats for a user with 20 logs a day returns within 200 ms.

## Alternatives considered

- **Snapshot table `daily_tag_volume(user_id, tag_id, local_date, seconds)` updated on every log insert** — rejected for now. It is feasible, because lessons with logs are locked (R7) and their tags never change. But it duplicates the logs, every insert must update one row per tag in the same transaction, it needs a backfill and consistency tests, and any drift would silently change historical stats. At the expected volume it buys a few milliseconds.
- **Materialised view refreshed periodically** — rejected: stats would lag behind a just-completed session.

## Consequences

- One source of truth: stats always equal the sum of the logs.
- Read cost grows with one user's logs in the range, not with the number of users.
- Revisit this decision, with the snapshot table as the first candidate, when any of these happens: weekly stats for a year exceed 200 ms on real data; stats start aggregating across many tags or users at once (e.g. totals, leaderboards); or one user's logs in a year exceed about 50,000.

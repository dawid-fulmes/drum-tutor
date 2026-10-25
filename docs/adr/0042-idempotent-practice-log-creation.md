# ADR-0042: Make practice log creation idempotent with a client-generated key

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD US-11, US-11b, R1, anti-goal "a completed session is logged twice"; ADR-0009, ADR-0034, ADR-0045; specs/practice-and-stats

## Context

A completed session is saved with one request. If the request fails or its response is lost, the client retries (US-11b). A retry after a lost response would create a second log, which doubles stats and is an anti-goal.

## Decision

- The client generates a UUID `idempotencyKey` once, when the session completes, and sends it with every attempt to save that session.
- `practice_logs` gets `idempotency_key uuid not null` with a unique index on `(user_id, idempotency_key)`.
- `POST /api/practice-logs` returns `201` for a new log and `200` with the stored log when the user already has a log with that key, regardless of the rest of the body. Concurrent attempts are resolved by the unique index.
- The client also sends `completedAt` (its clock at completion) and `localDate`, so a log saved after several retries keeps its real completion time and day.

## Alternatives considered

- **Client-generated log id as the primary key (`PUT /api/practice-logs/:id`)** — rejected: mixes identity with deduplication and lets clients choose primary keys.
- **Deduplicate by (user, lesson, completedAt)** — rejected: fragile and implicit.
- **Server time as `completedAt`** — rejected: a delayed retry would move the session in time and possibly to another day.

## Consequences

- Existing rows get a generated key in the migration.
- A replay with a different body silently returns the original log; this is acceptable because the key identifies the session.

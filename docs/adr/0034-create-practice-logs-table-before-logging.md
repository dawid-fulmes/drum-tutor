# ADR-0034: Create the practice_logs table before logging exists, so lesson locking is real now

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD §4.4, R7, R11, US-17a, US-18, US-19; ADR-0003, ADR-0007, ADR-0008; specs/lessons-and-tags

## Context

A lesson is locked once it has at least one practice log (R7, ADR-0003), and a published lesson can return to draft only without logs (R11, ADR-0008). The `lessons-and-tags` scope builds lesson editing, deletion and unpublishing, but practice logging comes in a later scope.

## Decision

The `lessons-and-tags` migration creates the `practice_logs` table with the columns from PRD §4.4 (user, lesson, duration in seconds, tempo, completion timestamp, local date). Nothing in the app writes to it yet; only tests and the seed insert rows. Lock checks for update, delete and unpublish query this table now, inside the same transaction as the write, and the `lesson_id` foreign key uses `on delete restrict` as a database backstop.

## Alternatives considered

- **Defer locking to the practice scope** — rejected: the lifecycle rules would ship untested and the admin UI would need a second pass for `locked`.
- **A `locked` boolean on lessons, set later** — rejected: duplicates the truth that "a log exists" and can drift from it.

## Consequences

- Locking is tested end to end now, with logs inserted directly in tests.
- The practice scope adds only what it needs (e.g. an idempotency key for US-11b) in its own migration. When it inserts logs, it must lock the lesson row in a way that conflicts with the admin's `SELECT … FOR UPDATE`, so a log cannot appear between an admin's lock check and write.

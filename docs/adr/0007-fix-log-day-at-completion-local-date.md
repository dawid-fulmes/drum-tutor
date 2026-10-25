# ADR-0007: Fix a log's day at completion using the user's local date

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD R12, §4.4, §5.6, anti-goal "historical statistics silently change"

## Context

Stats are per day. A day boundary depends on time zone. If logs were stored only as UTC and bucketed in the viewer's current time zone, sessions would move between days when the user travels, after DST changes, or on a device with a different zone.

## Decision

Each log stores the UTC completion timestamp and the user's local calendar date at the moment of completion (supplied by the client). Daily stats group by that stored local date. It is never recomputed.

## Alternatives considered

- **UTC timestamp only, bucket by viewer's time zone** — rejected: violates the anti-goal; history shifts.
- **Store a per-user time zone setting** — rejected: extra setting, and still wrong for sessions done while travelling.

## Consequences

- The API must accept and validate the local date on log creation (e.g. within ±1 day of the UTC timestamp).
- Stats queries are simple date-range queries on the local date column.
- A malicious client can choose a wrong local date within the allowed window; acceptable while users are trusted (ADR-0001).

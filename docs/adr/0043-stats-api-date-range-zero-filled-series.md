# ADR-0043: Serve stats as a zero-filled series in seconds for a requested date range

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD US-14, US-15, R6, R10, R12; ADR-0006, ADR-0007, ADR-0041; specs/practice-and-stats

## Context

The stats screen shows practice per day or per week for one tag in a week, month or year. Someone has to decide period boundaries, fill days without practice with zeros and sum durations per tag. The backend owns business rules (TECH_STACK), and the frontend must not aggregate over raw logs.

## Decision

- Two endpoints, `GET /api/stats/daily` and `GET /api/stats/weekly`, both taking `tagId`, `from` and `to` (local dates, inclusive).
- The client computes the period's range from its own calendar (week, month, year) and asks for it; the API knows nothing about periods.
- The response contains every day (or clipped week) of the range, ascending, with `seconds` — zero where there is no practice. Durations stay in seconds like everywhere else (R10); the UI converts to minutes.
- Logs are bucketed by their stored `local_date` (ADR-0007) and counted in full toward every tag of their lesson (ADR-0006).
- Limits: daily at most 31 days, weekly at most 366 days. Unknown tag is `404`.

## Alternatives considered

- **Period-based endpoint (`period=week&date=…`)** — rejected: puts calendar presentation rules (week start, labels) into the API and ties it to the current screen.
- **Return only non-zero days** — rejected: the client would fill gaps, which is aggregation logic on the frontend.
- **Return minutes** — rejected: every stored and transported duration is in seconds.

## Consequences

- The client still decides which days are "in the future" for display, because only it knows the user's current local date.
- Adding a period (e.g. a quarter) needs no API change as long as it fits the range limits.

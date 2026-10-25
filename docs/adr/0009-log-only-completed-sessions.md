# ADR-0009: Log only sessions that run to the end

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD R1, R2, US-8, US-10, US-11, US-11a, US-11b, anti-goals; ADR-0016

## Context

Stats must reflect real practice. Sessions can end early by user action or by interruptions (tab hidden, screen lock, app closed), and saving a completed log can fail on a bad connection.

## Decision

- A log is created only when the timer reaches the end. Stopped sessions leave no trace (no "failed attempt" records).
- The 4-click count-in is never part of the logged duration.
- Any interruption that stops the metronome (leaving the app/tab, screen lock, closing the app) is treated as a stop.
- If saving a completed log fails, the user is told and the client retries until it succeeds. Each session carries a client-generated identifier so retries never create duplicate logs (idempotent create).

## Alternatives considered

- **Log partial sessions with actual duration** — rejected: product wants a clear "completed" signal and no credit for abandoned sessions.
- **Keep running in background** — rejected: we cannot verify the user was actually practicing, and browsers throttle background audio unpredictably.
- **Drop the log on save failure** — rejected: loses real practice.

## Consequences

- The log-create endpoint must be idempotent on the client session identifier.
- The player must detect visibility/lifecycle interruptions and stop.
- No data on abandonment exists for future analytics.

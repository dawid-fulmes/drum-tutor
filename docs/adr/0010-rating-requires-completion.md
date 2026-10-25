# ADR-0010: Allow rating only after completing a lesson, one editable rating per user

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD R3, R4, §4.5, US-12, US-13, anti-goal "rate a lesson never completed"

## Context

Ratings drive sorting in the library, so they should come from people who actually played the exercise.

## Decision

- A user may rate a lesson (integer 1–5) only if they have at least one practice log for it. The backend enforces this.
- One rating per user per lesson; the user may change it at any time.
- No pop-up after completion: the rating control on the lesson screen is disabled with a "try it first" call to action until the first completion, then becomes active.
- Displayed rating = average of all ratings + number of ratings.

## Alternatives considered

- **Prompt for rating right after completion** — rejected: interrupts the practice flow; the always-visible control is enough.
- **One rating per completion** — rejected: frequent players would dominate the average.

## Consequences

- Rating is an upsert keyed by (user, lesson).
- The lesson endpoint must tell the client whether the current user may rate and what their current rating is.

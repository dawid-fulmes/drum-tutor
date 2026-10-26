# ADR-0056: A rating can be changed but not removed

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-26
- **Related:** PRD §4.5, US-13; R4; ADR-0010, ADR-0055; specs/rating

## Context

R4 says a user has one rating per lesson and may change it at any time. The PRD does not say whether a user may take a rating back, so that the lesson goes back to "not rated by me".

## Decision

A rating can be changed to any other value 1–5, but it cannot be removed. The API has no `DELETE` for ratings, and the rating modal has no "clear" action.

The product owner made this call in brainstorming, for now.

## Alternatives considered

- **Allow removing a rating** — rejected for now: no user story asks for it, and it adds an endpoint, a UI action and a second write path to keep the stored aggregate correct (ADR-0055).

## Consequences

- The only write path for ratings is the upsert, so every lesson's count can only grow.
- If removal is added later, it is a new endpoint that must use the same locked recompute as the upsert (ADR-0055).

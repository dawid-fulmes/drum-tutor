# ADR-0057: Rank by plain average rating; equal averages by number of ratings, then newest

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-26
- **Related:** PRD §4.5, US-5; R13; ADR-0012, ADR-0055, ADR-0058; specs/rating

## Context

US-5 sorts the library "by average rating", and ADR-0012 puts unrated lessons last and asks for a deterministic tie-breaker for stable pagination. The order between lessons with the same average is not specified. A plain average also ranks a lesson with a single 5 above one with a hundred ratings averaging 4.9.

## Decision

- Sort key, in order: `rating_avg` descending (unrated lessons, whose average is null, last), `rating_count` descending, `created_at` descending, `id` descending.
- The average is the plain arithmetic mean stored to two decimals (ADR-0055). There is no weighting and no minimum number of ratings.
- Unrated lessons are therefore ordered newest first among themselves.

## Alternatives considered

- **Bayesian (damped) average or a minimum-ratings threshold** — rejected for the MVP: the PRD names the plain average, and the displayed number would no longer explain the order. Revisit if few-rating lessons visibly crowd out well-rated popular ones.
- **Equal averages by date only (the example in ADR-0012)** — rejected: when averages are equal, the lesson more drummers vouched for is the better pick.

## Consequences

- The order is fully deterministic, so offset pagination has no duplicates or gaps.
- A brand-new lesson with one high rating can rank at the top. This is accepted as part of the MVP's validation goal.

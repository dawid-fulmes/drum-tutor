# ADR-0012: Library filter and sort semantics

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD R5, R13, US-2–US-5

## Context

Filtering by several tags or levels can mean "all of" or "any of", and sorting by rating needs a rule for unrated lessons. Different readings produce visibly different libraries.

## Decision

- Tag filter: AND — a lesson must have all selected tags (selecting more tags narrows results).
- Difficulty filter: OR — a lesson matching any selected level is shown.
- Sorting: by creation date (newest/oldest) or by average rating; lessons without ratings go last when sorting by rating.
- The list is paginated server-side; filters and sorting apply to the whole result set.
- No text search in the MVP.

## Alternatives considered

- **Tag filter as OR** — rejected: product wants tags to narrow the search.
- **Client-side filtering of a full list** — rejected: breaks with pagination and pushes business logic to the frontend.

## Consequences

- The library endpoint takes tag IDs, levels, sort and page parameters and returns a page plus total count.
- Sorting by rating needs a deterministic tie-breaker (e.g. creation date, then ID) for stable pagination.

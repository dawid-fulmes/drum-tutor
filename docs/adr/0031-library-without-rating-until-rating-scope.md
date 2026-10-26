# ADR-0031: Leave rating out of the library contract and UI until the rating scope

- **Type:** decision
- **Status:** superseded by ADR-0059
- **Date:** 2026-10-25
- **Related:** PRD US-2, US-5, US-6, US-12, US-13, R3, R4; ADR-0010, ADR-0012; specs/lessons-and-tags

## Context

US-2 and US-6 show the average rating and rating count, and US-5 allows sorting by rating. Rating depends on practice logs (R3), which do not exist before the practice scope. The `lessons-and-tags` scope builds the library before both.

## Decision

The library and details contracts carry no rating fields, the UI shows nothing about rating (no "No ratings yet", no "0.0"), and the only sort options are newest and oldest. The rating scope adds the fields, the display and the "sort by rating" option (with unrated lessons last, ADR-0012).

## Alternatives considered

- **A ratings table now and real aggregates that are always empty** — rejected: designs the rating data model before the rating feature, for a value that is always empty.
- **A nullable `averageRating` field returning `null`** — rejected: a contract field with no source of truth; the frontend would render a placeholder for data that cannot exist yet.

## Consequences

- US-2, US-5 and US-6 stay unticked in the PRD until the rating scope.
- Adding rating later is an additive contract change (new fields, new sort value).

# ADR-0041: Show the year stats view as weekly totals, Monday–Sunday weeks clipped to the year

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD US-14, US-15, R6, R12; ADR-0006, ADR-0007, ADR-0043; specs/practice-and-stats

## Context

US-14 asks for "minutes practiced per day" for a chosen period of a week, a month or a year. For a year that means 365 bars, which become hairlines that cannot be read or hovered. The product owner preferred a bar chart in all three periods and asked for weekly aggregation in the year view, served by its own endpoint.

## Decision

- Week and month views show one bar per day (`GET /api/stats/daily`).
- The year view shows one bar per week (`GET /api/stats/weekly`). Weeks run Monday to Sunday and are clipped to 1 January – 31 December, so the first and last bars may cover fewer than 7 days, and a year's bars add up to the same total as its months.
- Weeks start on Monday everywhere in stats.

## Alternatives considered

- **365 daily bars** — rejected: unreadable.
- **Calendar heatmap, one square per day** — rejected by the product owner in favour of a single chart type.
- **ISO weeks (week-numbering year)** — rejected: the year view would include days of the neighbouring year and disagree with the month totals.
- **Monthly bars for the year** — not chosen: too coarse to follow week-to-week progress.

## Consequences

- PRD §5.6 gets a note that the year view shows weekly totals.
- The weekly endpoint must handle clipping; the client never regroups days into weeks.

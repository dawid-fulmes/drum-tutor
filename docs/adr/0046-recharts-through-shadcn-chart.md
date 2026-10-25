# ADR-0046: Add Recharts through the shadcn chart component

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD US-14; TECH_STACK "UI"; ADR-0037; specs/practice-and-stats

## Context

TECH_STACK names Recharts for the stats chart, but no dependency was added yet. The UI otherwise uses stock shadcn/ui components (ADR-0037).

## Decision

Add the stock shadcn `chart` component, which wraps Recharts and brings it in as a dependency of `apps/web`, pinned to an exact version like the other dependencies. The stats bar chart is built from it.

## Alternatives considered

- **Hand-written SVG bars** — rejected: tooltips, axes and responsiveness would be re-implemented.
- **Another chart library (Chart.js, visx, ECharts)** — rejected: Recharts is already the documented choice and shadcn ships a themed wrapper for it.

## Consequences

- The chart follows the shadcn theme tokens without custom styling work.
- One more sizeable dependency in the web bundle; acceptable for one chart screen.

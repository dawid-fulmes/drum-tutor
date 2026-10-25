# ADR-0037: Add stock shadcn components for the admin UI and the cmdk dependency

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** specs/lessons-and-tags; ADR-0017; docs/TECH_STACK.md (UI row); `apps/web/src/components/ui`, `biome.json`

## Context

The admin UI (lessons and tags) needs alerts, dialogs, selects, tables, pagination, a searchable multi-select and similar building blocks. TECH_STACK already fixes shadcn/ui (radix-nova style, `radix-ui` umbrella package, `lucide-react`). We must not hand-roll components that shadcn provides.

## Decision

Add these stock shadcn components with `shadcn@4.22.1`: alert, alert-dialog, badge, card, checkbox, command, dropdown-menu, empty, pagination, popover, radio-group, select, skeleton, slider, table, textarea, toggle-group, tooltip. The CLI also pulled in their internal dependencies: dialog, input-group and toggle.

The only new npm dependency is `cmdk` 1.1.1 (pinned exactly), required by the Command component (used for the searchable tag picker). Everything else builds on `radix-ui` and `lucide-react`, already in the repo. No date or icon library was added.

The generated `components/ui/**` files are kept as the CLI produced them. Biome has a path override for that folder that turns off four rules the stock code violates (`a11y/useSemanticElements`, `a11y/useKeyWithClickEvents`, `a11y/noRedundantRoles`, `suspicious/noArrayIndexKey`), so regenerating or updating components does not need hand edits.

## Alternatives considered

- **Hand-written selects, dialogs and pickers** — rejected: more code, worse accessibility, diverges from the stack.
- **Another combobox library (e.g. downshift)** — rejected: shadcn's Command is the stock answer and brings only `cmdk`.
- **Editing generated files to satisfy Biome** — rejected: every CLI update would need the same edits again.

## Consequences

- One more runtime dependency (`cmdk`) to keep updated.
- Lint is relaxed only for generated UI primitives; our own code keeps the full recommended rule set.
- Components added later with the shadcn CLI land under the same override.

# ADR-0060: Remaining library UI gaps after the rating rework

- **Type:** tech-debt
- **Status:** open
- **Date:** 2026-10-26
- **Related:** specs/rating, ADR-0027, ADR-0039

## Context

ADR-0039 listed four small gaps in the drummer library UI. Items 2 (pager hidden while loading and on empty results) and 3 (no 20-tag limit in the TagPicker) were due "when the library is reworked in the rating scope". That scope fixes them. Items 1 and 4 have other triggers.

## Decision

The rating scope repays ADR-0039 items 2 and 3. Items 1 and 4 carry over unchanged into this record, which supersedes ADR-0039.

## Alternatives considered

- **Repay all four items in the rating scope** — rejected: item 1 belongs to the visual design pass and item 4 needs a component test setup that does not exist yet (ADR-0027).
- **Mark ADR-0039 repaid and drop items 1 and 4** — rejected: they would be forgotten.

## Consequences

- The pager stays mounted with disabled controls while loading and on empty results.
- The library tag picker stops at 20 selections.
- Screen-reader users still get no loading announcement in the library and on the lesson page.

## Debt

- **Shortcut taken:**
  1. The library and lesson page skeletons, including the new rating row, have no `aria-busy` or other loading announcement.
  2. There are no component tests for the page clamp and unknown-tag prune effects, the details error mapping, the query option shapes, or the rating modal.
- **Why accepted:** none of these affect the current single-developer usage.
- **Risk while open:** poorer accessibility and regressions in untested effects.
- **Repayment trigger:** item 1: before public release or the visual design pass (PRD §7). Item 2: when a component test setup is introduced (ADR-0027 repayment).
- **Repayment sketch:** mark skeleton containers `aria-busy` with a live status text; add component tests for the effects, the error mapping and the modal's keyboard behaviour.

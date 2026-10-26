# ADR-0039: Leave known small gaps in the drummer library UI until the rating scope

- **Type:** tech-debt
- **Status:** superseded by ADR-0060
- **Date:** 2026-10-25
- **Related:** specs/lessons-and-tags, ADR-0027, ADR-0038

## Context

The whole-plan review of the drummer library UI (plan 03 of `lessons-and-tags`) found a few small accessibility, usability and test-coverage gaps. The library is going to be reworked in the rating scope anyway, and the visual design pass has not happened yet (PRD §7).

## Decision

Ship the library UI with the gaps listed under Debt, each with its own repayment trigger.

## Alternatives considered

- **Fix every gap in this scope** — rejected: several of them depend on the rating-scope rework or the design pass.
- **Not recording them** — rejected: they would be rediscovered as surprises.

## Consequences

- Screen-reader users get no loading announcement in the library and on the details page.
- The pager is not available while a page loads or when there are no results.

## Debt

- **Shortcut taken:**
  1. The library and details skeletons have no `aria-busy` or other loading announcement.
  2. The pager, including the per-page Select, is hidden while a page loads and on empty results (a consequence of the skeleton rule in spec §12).
  3. The TagPicker has no 20-tag limit, while the library URL schema caps `tagIds` at 20 (`.max(20).catch([])`), so selecting a 21st tag would clear all of them. This is practically unreachable because lessons have at most 10 tags.
  4. There are no component tests for the page clamp and unknown-tag prune effects, the details error mapping, or the query option shapes.
- **Why accepted:** none of these affect the current single-developer usage, and 2 and 3 disappear or change with the library rework.
- **Risk while open:** poorer accessibility, a surprising filter reset in an unlikely case, and regressions in untested effects.
- **Repayment trigger:** item 1: before public release or the visual design pass (PRD §7). Items 2 and 3: when the library is reworked in the rating scope. Item 4: when a component test setup is introduced (ADR-0027 repayment).
- **Repayment sketch:** mark skeleton containers `aria-busy` with a live status text, keep the pager mounted with disabled controls, cap the picker at 20 tags, and add component tests for the effects and error mapping.

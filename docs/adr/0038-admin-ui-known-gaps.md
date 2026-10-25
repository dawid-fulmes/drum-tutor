# ADR-0038: Leave known small gaps in the admin UI until the admin panel has other users

- **Type:** tech-debt
- **Status:** open
- **Date:** 2026-10-25
- **Related:** specs/lessons-and-tags, ADR-0027, ADR-0037

## Context

The whole-branch review of the admin UI (plan 02 of `lessons-and-tags`) found a set of small accessibility, robustness and test-coverage gaps. The admin panel is used only by the developer for now, and fixing each gap properly costs more than the current scope justifies.

## Decision

Ship the admin UI with the gaps listed under Debt, each with its own repayment trigger.

## Alternatives considered

- **Fix every gap in this scope** — rejected: it delays the library UI for gaps with no effect on a single-developer admin.
- **Not recording them** — rejected: they would be rediscovered as surprises.

## Consequences

- Keyboard-only and screen-reader use of the admin panel is not fully supported yet.
- Some rare failure paths behave slightly roughly (see the list).

## Debt

- **Shortcut taken:** the following gaps are left unhandled.
  1. The lock icon on a locked lesson is not keyboard-reachable.
  2. The tag delete dialog can be closed mid-request.
  3. Disabled Prev/Next pagination anchors still call the handler when invoked programmatically.
  4. The disabled tag Delete button sits in a focusable `span` wrapper with no accessible name (with a `biome-ignore`).
  5. Focus is lost after "Add tag".
  6. A failed next-page fetch in an infinite list replaces the loaded list with the error; "Try again" refetches all pages.
  7. `buildUrl` emits `key=` for empty strings inside arrays.
  8. There are no component tests for the tag picker, load-more sentinel, search debounce and the forms (ADR-0027).
  9. The in-flight ref guard against double submits is duplicated in several components.
  10. If a selected tag is deleted elsewhere while a lesson form is open, its id stays selected and the save fails.
- **Why accepted:** keeps the scope moving; none of these affect the developer-only admin flow.
- **Risk while open:** poorer accessibility, confusing behaviour on rare failures, and regressions in untested UI.
- **Repayment trigger:** items 1-5 and 10: before the admin panel is used by people other than the developer. Items 6, 7 and 9: when the next feature touches the same code (the library infinite list, or a third use of the guard). Item 8: when a component test setup is introduced (ADR-0027 repayment).
- **Repayment sketch:** make the lock a focusable button with a tooltip, lock the dialog while pending, guard handlers, return focus to the input, keep loaded pages on a failed next-page fetch, drop empty array entries in `buildUrl`, extract a shared double-submit hook, add component tests, and drop unknown tag ids from the form on a lookup miss.

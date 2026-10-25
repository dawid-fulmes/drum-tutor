# ADR-0030: Create and publish lessons without a signature until the signature scope

- **Type:** tech-debt
- **Status:** superseded by ADR-0040
- **Date:** 2026-10-25
- **Related:** PRD §4.1, §4.2, US-6, US-17; ADR-0005, ADR-0008; specs/lessons-and-tags

## Context

PRD §4.1 lists the signature (the 8-slot notation from §4.2) as a lesson property, and US-6 / US-17 expect it to be built in the admin form and drawn on the lesson screen. Building the slot editor and the notation rendering is a sizeable piece of UI work of its own. The `lessons-and-tags` scope wants to deliver the library, tags and the lesson lifecycle first.

## Decision

In the `lessons-and-tags` scope the signature does not exist anywhere: no column, no contract field, no form section, no rendering. Lessons can be created and published without it. The lesson details page shows a dashed box with "Sheet coming soon" where the signature will go, and the Start button that will lead to the player is always disabled.

## Alternatives considered

- **Build the signature editor and renderer in this scope** — rejected by the product owner: it would delay the library and admin, which can be validated without it.
- **Store the signature now without UI (JSON column, seeded only)** — rejected: an unused contract field with no way to edit it, and a shape that would be decided without the editor that produces it.
- **Block publishing until a signature exists** — not possible while the signature cannot be entered.

## Consequences

- US-6 and US-17 stay unticked in the PRD after this scope.
- Lessons in the database have no notation; the player cannot be built before the signature scope.

## Debt

- **Shortcut taken:** published lessons have no signature, although the PRD makes it part of every lesson.
- **Why accepted:** lets the library, tags and lesson lifecycle ship and be validated first.
- **Risk while open:** lessons published in the meantime are incomplete; drummers see a placeholder instead of notation.
- **Repayment trigger:** the signature scope, which must land before (or together with) the practice player scope.
- **Repayment sketch:** add a required `signature` (8 slots per ADR-0005) to the data model and `LessonInput`, a slot editor in the lesson form, rendering on the details page, and make publishing require a signature. Existing lessons are disposable (ADR-0004) or get a signature added before the column becomes required.

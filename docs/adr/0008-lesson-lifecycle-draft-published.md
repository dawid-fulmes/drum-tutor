# ADR-0008: Lesson lifecycle — draft, published, back to draft only without logs

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD R7, R11, US-17, US-17a, US-18; ADR-0003

## Context

Practiced lessons become locked (ADR-0003). Without a staging state, a lesson becomes visible immediately and a mistake spotted after someone's first completion becomes permanent.

## Decision

- New lessons are created as `draft`, invisible to drummers, freely editable and deletable.
- The admin publishes a draft to make it visible in the library and practicable.
- A published lesson can return to `draft` only while it has no practice logs. Once it has at least one log it stays `published` and locked.
- Only published lessons can be practiced, logged and rated.

## Alternatives considered

- **Visible on save, no draft state** — rejected: makes mistakes permanent too easily.
- **Hide/retire for locked lessons** — postponed to the repayment of ADR-0003.

## Consequences

- Lesson status is part of the data model and every drummer-facing query filters on `published`.
- Status transitions and the "has logs" check are enforced by the backend.

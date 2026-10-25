# ADR-0003: Lock lessons against edit and delete once they have practice logs

- **Type:** tech-debt
- **Status:** open
- **Date:** 2026-10-25
- **Related:** PRD R7, R11, US-17a, US-18, US-19, anti-goal "historical statistics silently change"; ADR-0006, ADR-0008

## Context

Statistics attribute log duration to the lesson's tags (ADR-0006) and must not change after the fact. If an admin edits the tags of a practiced lesson, stats derived from current tags would silently rewrite history. Deleting a practiced lesson would orphan or remove logs.

## Decision

A lesson with at least one practice log cannot be edited or deleted. Lessons without logs can be freely edited and deleted. The admin lesson list shows which lessons are locked.

## Alternatives considered

- **Snapshot the lesson's tags into each log** — rejected for MVP: more data model and stats complexity; postponed to repayment.
- **Lesson versioning** — rejected for MVP: same reason.
- **Soft delete** — rejected for MVP: does not solve editing.

## Consequences

- A mistake noticed after the first completion cannot be fixed; drafts (ADR-0008) are the mitigation.
- Stats can be computed from the lesson's current tags, because those tags can no longer change once logs exist.

## Debt

- **Shortcut taken:** practiced lessons are immutable instead of properly versioned.
- **Why accepted:** removes the "history vs. changed tags" problem from the MVP entirely.
- **Risk while open:** content errors in practiced lessons are permanent; the library may accumulate lessons the admin would like to correct or retire.
- **Repayment trigger:** when admins need to correct or retire practiced lessons (planned for the next iteration).
- **Repayment sketch:** snapshot tags (and other stats-relevant fields) into logs or version lessons; compute stats from the snapshot; allow retire/hide instead of delete.

# ADR-0011: Manage tags as an admin dictionary with rename-always, delete-if-unused

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD R8, R9, §4.3, US-16; ADR-0006

## Context

Tags drive filtering and statistics. Free-text tags per lesson would create near-duplicates ("weak hand" vs "Weak Hand") and split stats.

## Decision

- Tags are a separate dictionary with unique names, managed only in the admin panel; lessons reference tags by identity.
- Renaming is always allowed (stats reference the tag, not its name, so history is unaffected).
- Deleting is allowed only when no lesson uses the tag.
- Every lesson must have at least one tag, otherwise its practice would never appear in stats.

## Alternatives considered

- **Free-text tags on lessons** — rejected: duplicates and inconsistent stats.
- **Delete with cascade** — rejected: would silently change stats of practiced lessons.

## Consequences

- Name uniqueness should be case-insensitive and whitespace-normalized.
- Removing a tag from a lesson is only possible while the lesson is editable (ADR-0003).

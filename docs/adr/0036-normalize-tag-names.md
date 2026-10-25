# ADR-0036: Trim and collapse whitespace in tag names; enforce case-insensitive uniqueness

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD §4.3, R8, US-16; ADR-0011, ADR-0024; specs/lessons-and-tags

## Context

PRD §4.3 requires unique tag names to prevent duplicates such as "weak hand" vs "Weak Hand". ADR-0011 says uniqueness should be case-insensitive and whitespace-normalized but does not define the normalization.

## Decision

- `TagNameSchema` in `packages/contracts` trims the name and collapses inner whitespace runs to a single space, then requires 1–50 characters. It is the one definition used by the admin form, the API and the database write.
- The name is stored with the casing the admin typed ("Weak hand" stays "Weak hand").
- Uniqueness is enforced by a unique index on `lower(name)`; a conflicting create or rename returns `409 TAG_NAME_TAKEN`. Renaming a tag to a different casing of its own name is allowed.

## Alternatives considered

- **Lowercase on storage (as for emails, ADR-0024)** — rejected: tag names are shown as labels, and the admin's casing is meaningful there.
- **`citext` column** — rejected: the same reasons as in ADR-0024; the API and client still need the normalized form.

## Consequences

- Tag search (`q`) and sorting are case-insensitive to match.
- Names that differ only in Unicode case forms beyond `lower()` are not caught; acceptable for an admin-curated dictionary.

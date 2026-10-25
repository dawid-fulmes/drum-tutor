# ADR-0024: Normalize emails by trimming and lowercasing

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD US-1, §3 Identification; ADR-0001; specs/project-foundation

## Context

Email is the only identity (ADR-0001), and login auto-creates unknown users. The PRD does not say whether `Jan@X.com` and `jan@x.com` are the same person. If they were treated as different, a typo in letter case would silently create a second, empty account and split a drummer's stats.

## Decision

Emails are trimmed and lowercased before validation and storage. This happens in one place: `EmailSchema` in `packages/contracts`, used by both the web form and the API. The `users.email` column is unique and only ever holds normalized values.

## Alternatives considered

- **Case-sensitive emails (store as typed)** — rejected: creates duplicate accounts from typos.
- **Provider-specific normalization (strip dots and `+tags` for Gmail)** — rejected: surprising, provider-dependent, and can merge addresses that really are different.
- **`citext` column** — rejected: works only at the DB level; the client and API would still disagree on the canonical form shown to the user.

## Relation to ADR-0004

ADR-0004 rejected "email normalization" as part of designing identity for a later migration to real authentication. This ADR does not reverse that: normalization here exists for correctness inside the MVP (no duplicate accounts from letter case), not to prepare a migration path. ADR-0004 stays as it is.

## Consequences

- The app always displays the normalized (lowercase) email, not what the user typed.
- Technically distinct mailboxes that differ only in local-part case are merged; acceptable, since almost no providers distinguish them.

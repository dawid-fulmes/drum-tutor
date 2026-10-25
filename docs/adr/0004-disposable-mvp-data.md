# ADR-0004: Treat MVP data as disposable

- **Type:** tech-debt
- **Status:** open
- **Date:** 2026-10-25
- **Related:** PRD §3 Audience of the MVP; ADR-0001, ADR-0002

## Context

The MVP is an internal test with a small, known group. Accounts are identified only by unverified email (ADR-0001).

## Decision

MVP data (users, logs, ratings, lessons, tags) does not need to survive into the iteration that introduces real authentication. No migration path for accounts or history is designed now.

## Alternatives considered

- **Design identity for later migration now** (stable IDs linked to future auth identities, email normalization, migration scripts) — rejected: effort without value for the validation goal.

## Consequences

- Schema changes during the MVP may drop and recreate data instead of writing careful migrations.
- No backup or retention guarantees for MVP data.
- Seed data (sample lessons and tags) is the only content we rely on being reproducible.

## Debt

- **Shortcut taken:** no data continuity, backups or account migration path.
- **Why accepted:** the MVP only validates business logic for internal users.
- **Risk while open:** any real usage history accumulated during the MVP may be lost.
- **Repayment trigger:** the moment we decide to keep any data beyond the MVP (at the latest when ADR-0001 is repaid).
- **Repayment sketch:** proper forward migrations, backups, and a mapping from email-only accounts to authenticated identities.

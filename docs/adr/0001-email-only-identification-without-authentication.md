# ADR-0001: Identify users by email only, without authentication

- **Type:** tech-debt
- **Status:** open
- **Date:** 2026-10-25
- **Related:** PRD §3 Identification, US-1; ADR-0002, ADR-0004

## Context

The MVP exists to validate the business logic (library, practice flow, logging, rating, stats). Authentication adds work that does not help that validation. The MVP is used by a small, known internal group (ADR-0004).

## Decision

The login screen has a single email field. Entering an email logs the user in; if no user with that email exists, one is created automatically. No password, no verification, no sessions beyond what is needed to remember the current user.

## Alternatives considered

- **Magic link / OAuth from day one** — rejected: extra infrastructure (email delivery, providers) with no value for validating business logic.
- **Password accounts** — rejected for the same reason, plus password-reset flows.

## Consequences

- Anyone who types someone else's email acts as that user (reads their stats, writes logs and ratings).
- The API must still identify the user on every request in a way that can later be replaced by a real auth mechanism without changing business endpoints.

## Debt

- **Shortcut taken:** no authentication at all; identity is a self-declared email.
- **Why accepted:** keeps the MVP focused on validating business rules.
- **Risk while open:** impersonation, polluted stats and ratings; unacceptable outside a trusted group.
- **Repayment trigger:** before the app is opened to anyone outside the internal test group.
- **Repayment sketch:** introduce real authentication (e.g. magic link or OAuth), keep user identity behind a single auth boundary in the API so business endpoints don't change.

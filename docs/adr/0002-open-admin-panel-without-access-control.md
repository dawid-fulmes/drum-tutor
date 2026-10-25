# ADR-0002: Leave the admin panel open without access control

- **Type:** tech-debt
- **Status:** open
- **Date:** 2026-10-25
- **Related:** PRD §3 Identification, US-16–US-19; ADR-0001, ADR-0004

## Context

Lessons and tags are configured by a super admin. Without authentication (ADR-0001) there is no reliable way to know who the admin is.

## Decision

The admin panel lives at `/admin` and is open to anyone who knows the URL. Admin API endpoints are likewise unprotected.

## Alternatives considered

- **Hardcoded allow-list of admin emails** — rejected: gives a false sense of security, since emails are not verified (ADR-0001).
- **Admin flag set manually in the database** — rejected for the same reason.

## Consequences

- Any user can create, edit, publish or delete content within the rules of ADR-0003 and ADR-0008.
- Admin endpoints should be grouped (e.g. under one route prefix) so access control can later be applied in one place.

## Debt

- **Shortcut taken:** no authorization for admin functions.
- **Why accepted:** without real authentication any admin check would be bypassable anyway.
- **Risk while open:** accidental or malicious content changes and deletions by any user.
- **Repayment trigger:** together with ADR-0001 — before any user outside the internal test group gets access.
- **Repayment sketch:** add an admin role on the authenticated user and enforce it on the grouped admin endpoints and the `/admin` route.

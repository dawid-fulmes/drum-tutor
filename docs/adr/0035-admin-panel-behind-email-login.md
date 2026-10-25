# ADR-0035: Put the admin panel behind the same email login as the drummer app

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD §3; ADR-0001, ADR-0002, ADR-0023; specs/lessons-and-tags

## Context

PRD §3 says `/admin` is "open to anyone who knows the URL" and ADR-0002 accepts the panel without access control. It does not say whether a visitor has to log in by email first. The app already has an `_authenticated` route layout and a `requireUser` API guard.

## Decision

`/admin` routes sit under the `_authenticated` layout and every admin API endpoint uses `requireUser`, exactly like drummer endpoints. Any logged-in user can use the admin; there is no admin role. The drummer app has no link to `/admin`.

## Alternatives considered

- **Admin reachable without logging in** — rejected: needs a second, unauthenticated route tree and API guard setup, and gains nothing, since logging in is just typing an email.

## Consequences

- One auth boundary for the whole API, which real authentication later replaces (ADR-0001).
- ADR-0002 stays open: being logged in is not an access check.

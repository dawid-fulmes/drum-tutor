# ADR-0045: Retry an unsaved practice log only while the page stays open, without an offline buffer

- **Type:** tech-debt
- **Status:** open
- **Date:** 2026-10-25
- **Related:** PRD US-11, US-11b; ADR-0042, ADR-0023; TECH_STACK "Offline support / PWA" out of scope; specs/practice-and-stats

## Context

US-11b requires that a completed session whose save fails is reported and retried until it succeeds, without duplicates. Retries could survive closing the tab if the pending log were kept in local storage and resent on the next visit. The product owner chose to leave offline behaviour out of the MVP.

## Decision

The pending log lives only in the page's memory. The client retries with backoff (1 s, 2 s, 4 s … capped at 30 s), without a limit, while the page is open, and offers "Retry now". Leaving the page while the log is unsaved asks for confirmation (`beforeunload` and a router navigation blocker). If the user leaves anyway, or the API answers `401` (lost session, redirect to `/login`), the log is lost.

## Alternatives considered

- **Keep the pending log in `localStorage` and resend it on the next app start** — postponed by the product owner together with other offline behaviour.
- **Service worker / Background Sync** — rejected for the MVP: offline support is out of scope (TECH_STACK).

## Consequences

- A user who closes the tab despite the warning, or whose cookie session is gone, loses a completed session.
- The idempotency key (ADR-0042) already makes a later resend safe, so the repayment needs no API change.

## Debt

- **Shortcut taken:** no persistence of an unsaved log beyond the open page.
- **Why accepted:** keeps the MVP free of offline storage and resend logic; failures are rare on the internal test.
- **Risk while open:** a completed session can be lost after a failed save (anti-goal is mitigated by the warning, not removed).
- **Repayment trigger:** when offline or mobile support is taken on (with ADR-0047), or as soon as a tester reports a lost completed session — whichever comes first, and before any public release.
- **Repayment sketch:** store the pending payload (with its idempotency key) in `localStorage` at completion, remove it on `200`/`201`, resend leftovers on app start for the same user, and drop the leave warning.

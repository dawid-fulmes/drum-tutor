# ADR-0047: Treat the app as desktop-first, without a screen wake lock during practice

- **Type:** tech-debt
- **Status:** open
- **Date:** 2026-10-25
- **Related:** PRD US-11, US-11a; ADR-0044; specs/practice-and-stats

## Context

A hidden page stops the session (ADR-0044). Phones and tablets on a music stand turn their screen off after 30 s–2 min without touch, which hides the page. Without the Screen Wake Lock API, almost every session longer than the auto-lock time would stop on such devices and never be logged.

## Decision

The MVP is desktop-first. The player requests no screen wake lock and shows no warning about it. On a device that auto-locks, the session stops like any other hidden page.

## Alternatives considered

- **Request a screen wake lock during count-in and play, warn when unsupported** — postponed by the product owner to keep the scope moving.

## Consequences

- Practising on a phone or tablet works only for sessions shorter than the device's auto-lock, or with auto-lock turned off by the user.
- No mobile-specific behaviour has to be built or tested in this scope.

## Debt

- **Shortcut taken:** no wake lock and no mobile guidance in the player.
- **Why accepted:** the internal test runs on desktop; the practice loop is validated first.
- **Risk while open:** testers on mobile lose sessions and may read it as a bug.
- **Repayment trigger:** when phones or tablets become a supported platform, at the latest before any test with users outside the team.
- **Repayment sketch:** request `navigator.wakeLock.request("screen")` on Start, release on stop or completion, re-request after the page becomes visible again in setup; in `setup`, warn when the API is unavailable or the request is refused.

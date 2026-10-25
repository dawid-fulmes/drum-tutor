# ADR-0044: Treat a hidden page or interrupted audio as a stopped session

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD US-10, US-11a, R1, anti-goals; ADR-0009, ADR-0016, ADR-0047; specs/practice-and-stats

## Context

US-11a says a session interrupted in a way that stops the metronome counts as stopped and is not logged. Browsers throttle or suspend timers and audio on hidden pages, and the PRD forbids logging time the user did not practice. We need concrete, testable triggers.

## Decision

During count-in or play, the session stops with nothing logged when:

- `document.visibilityState` becomes `hidden` (tab switch, minimised window, screen lock, app to background);
- the `AudioContext` leaves the `running` state for a reason other than our own stop or completion;
- the page unloads (reload, close) or the practice panel unmounts (in-app navigation, including to another lesson).

Losing focus while the page stays visible does not stop the session. After an automatic stop the panel shows a short note that nothing was logged.

## Alternatives considered

- **Stop only when audio actually stops** — rejected: browsers differ in when they suspend audio, so behaviour would be unpredictable.
- **Allow a short grace period when hidden** — rejected: the user cannot hear or see the metronome state, and it complicates the "nothing logged" guarantee.
- **Stop on window blur** — rejected: too aggressive on desktop, where a drummer may click another window while the tab stays visible.

## Consequences

- On mobile devices that auto-lock, long sessions stop (accepted in ADR-0047).
- The rule is simple to verify in the browser by hiding the tab.

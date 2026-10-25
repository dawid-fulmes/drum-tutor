# ADR-0016: Implement the metronome on the Web Audio API without an audio library

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD US-8, US-9, US-11a; ADR-0005, ADR-0009

## Context

The player needs a 4-click count-in and a quarter-note click with an accent on beat 1 at 30–300 BPM, with stable timing. JavaScript timers alone drift and jitter under UI load.

## Decision

Use the Web Audio API directly with a look-ahead scheduler: a short timer schedules upcoming clicks on the audio clock. Clicks are synthesized or short preloaded samples. The exercise end is measured from the audio clock, not wall-clock timers.

## Alternatives considered

- **Tone.js** — rejected: large dependency for a single click track; groove playback is a non-goal (ADR-0005).
- **`setInterval` + `<audio>` elements** — rejected: audible timing jitter.

## Consequences

- We own the scheduler code and must test it for drift and correct start/stop/count-in behavior.
- If groove playback is added later, re-evaluate a library.

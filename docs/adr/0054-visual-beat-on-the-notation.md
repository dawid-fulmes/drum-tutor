# ADR-0054: Show the count-in and the current quarter note on the notation, driven by the audio clock

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-26
- **Related:** PRD US-8, US-9; ADR-0016, ADR-0040 (repaid), ADR-0051, ADR-0052; specs/signature; `apps/web/src/features/practice`

## Context

ADR-0040 shipped the practice player as sound only and left the visual beat to the signature scope. Its sketch was to highlight the current slot. In brainstorming the product owner described the visuals they want. During the 4 count-in clicks the notation is greyed out under a big, game-style countdown. During play, a vertical line lights up at the current **quarter note** on each click, not at every eighth-note slot.

## Decision

- **Count-in:** the notation is dimmed and desaturated. On top of it, a large number on a translucent white plate (a dark equivalent in dark mode) counts `4 → 3 → 2 → 1`, changing on each count-in click.
- **Playing:** a vertical line, with a soft band behind it, marks the current beat (1–4) at that beat's first slot. It moves on each click.
- **Otherwise** (setup, after stop, after completion) the notation is static.
- Both visuals are derived from `audioContext.currentTime` and the existing click plan, in the panel's existing animation-frame loop. They are pure functions with unit tests, never JS timers (ADR-0016).

This repays the visual-beat part of ADR-0040. The other part of its debt, published lessons without a signature, is repaid in the same scope by ADR-0050 (every lesson has a signature) and ADR-0053 (a published one has notes).

## Alternatives considered

- **Highlight every eighth-note slot** (ADR-0040's sketch) — rejected by the product owner: the click is on quarter notes, and the eye should follow the click.
- **A separate beat indicator (four dots)** — rejected already in ADR-0040.
- **A continuously moving playhead** — rejected: harder to read at a glance than a beat-locked marker, and it does not match the click.

## Consequences

- The notation component takes an optional "visual state" (static, count-in with a number, playing with a beat index) from the practice panel.
- Visual and audio stay in sync within one animation frame, because both read the audio clock.

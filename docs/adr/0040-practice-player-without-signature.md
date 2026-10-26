# ADR-0040: Ship the practice player without the signature and without a visual beat

- **Type:** tech-debt
- **Status:** repaid in ADR-0054
- **Date:** 2026-10-25
- **Related:** PRD §4.2, US-6, US-9, US-17; ADR-0005, ADR-0016, ADR-0030; specs/practice-and-stats

## Context

ADR-0030 let lessons exist without a signature and set its repayment trigger as "the signature scope, which must land before (or together with) the practice player scope". The product owner decided to build the practice player and stats (`practice-and-stats`) first and keep the signature a separate, later scope. The player could show a visual beat (e.g. four dots), but that indicator belongs with the rendered notation, where the current slot is highlighted.

## Decision

The practice player ships while lessons still have no signature. The lesson page keeps the "Sheet coming soon" placeholder above the practice panel. The metronome is sound only: no beat indicator, count-in visual or animation tied to the beat. This record supersedes ADR-0030 and carries its debt forward with a new trigger.

## Alternatives considered

- **Build the signature first, as ADR-0030 assumed** — rejected by the product owner: the practice loop and stats can be validated without notation.
- **Add a temporary four-dot beat indicator** — rejected by the product owner: it would be replaced by the notation highlight and designed twice.

## Consequences

- Drummers practice from the lesson description and the click; the lesson page has no notation.
- US-6 and US-17 stay unticked in the PRD.
- The signature scope must also design the visual beat during play.

## Debt

- **Shortcut taken:** published lessons have no signature (carried over from ADR-0030), and the player has no visual beat.
- **Why accepted:** the practice loop, logging and stats are validated first.
- **Risk while open:** drummers cannot see what to play; a lesson is only as clear as its description.
- **Repayment trigger:** the signature scope, which comes next after `practice-and-stats` and before any test with users outside the team.
- **Repayment sketch:** the sketch from ADR-0030 (required 8-slot `signature`, slot editor, rendering, publishing requires a signature), plus highlighting the current slot during count-in and play, driven by the same audio-clock scheduler.

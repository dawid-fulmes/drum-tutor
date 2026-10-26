# ADR-0005: Limit the exercise signature to one 4/4 bar of eighth notes and three instruments

- **Type:** tech-debt
- **Status:** superseded by ADR-0051
- **Date:** 2026-10-25
- **Related:** PRD §4.2, non-goals; ADR-0016

## Context

Each lesson shows a notation ("signature") of how to play it. Full music notation (meters, tuplets, multiple bars, many instruments) is a large problem; the MVP exercises (singles on a pad, money beat) fit a much simpler model.

## Decision

A signature is exactly one bar in 4/4 split into 8 eighth-note slots. Each slot has a list of instruments from `snare`, `hihat-closed`, `kick` (empty list = rest) and an optional short comment (e.g. sticking `R`/`L`). It is rendered as a simple schema, not staff notation. The metronome does not play the signature back.

## Alternatives considered

- **Staff notation / MusicXML / ABC** — rejected: rendering and authoring cost far beyond MVP needs.
- **Free-form grid (any subdivision, any length)** — rejected: complicates the admin editor and validation without MVP exercises that need it.

## Consequences

- Validation is simple (exactly 8 slots, known instrument set).
- The admin editor and renderer can be fixed-size.
- Many real exercises (sixteenths, triplets, fills, odd meters, toms/cymbals) cannot be expressed.

## Debt

- **Shortcut taken:** fixed-size, fixed-meter signature with a closed instrument list.
- **Why accepted:** covers the MVP exercises with minimal modelling, editing and rendering effort.
- **Risk while open:** content team hits the limits quickly; storing the shape as rigid columns would make extension expensive.
- **Repayment trigger:** first lesson that needs a different subdivision, meter, length or instrument.
- **Repayment sketch:** add meter, subdivision and bar count to the signature and make slots variable-length; extend the instrument enum; version the signature format so existing lessons stay valid.

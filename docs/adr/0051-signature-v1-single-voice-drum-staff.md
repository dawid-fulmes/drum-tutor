# ADR-0051: Signature format v1 — one 4/4 bar of eighths, three instruments, drawn as a single-voice drum staff

- **Type:** tech-debt
- **Status:** open
- **Date:** 2026-10-26
- **Related:** PRD §4.2, non-goals; US-6, US-17; ADR-0005 (superseded), ADR-0050, ADR-0052; specs/signature

## Context

ADR-0005 limited the signature to one 4/4 bar of 8 eighth-note slots with `snare`, `hihat-closed` and `kick`, and said it would be drawn as a simple schema, not staff notation. On the brainstorming mockups the product owner asked for the drummer view to look as close to real drum notation as possible. The format limits of ADR-0005 still apply. Versioning (ADR-0050) now gives a way out of them that ADR-0005 only sketched.

## Decision

- Format `v1` keeps ADR-0005's content model: exactly 8 eighth-note slots of one 4/4 bar. Each slot has 0–3 distinct instruments from `hihat-closed`, `snare`, `kick` (none = rest) and a comment of at most 3 characters (`""` = none).
- It is drawn as a **drum staff**: five lines, percussion clef, `4/4`, x notehead for the hi-hat above the staff, snare in the third space, kick in the bottom space. Eighths are beamed per quarter note, a lone eighth gets a flag, rests are eighth rests (a quarter rest for a fully empty beat), sticking sits above the notes, and counting `1 & 2 & …` sits below.
- **One voice, all stems up.** Hands and feet share stems; the kick does not get its own downward voice and rests.
- The metronome still does not play the pattern back.

This supersedes ADR-0005 and carries its debt forward with versioning in place.

## Alternatives considered

- **Schema/grid rendering as in ADR-0005** — rejected by the product owner: drummers read staff notation.
- **Two voices (hands up, kick down with its own rests)** — closer to published drum notation, but needs per-voice durations and rest logic. Deferred: v1 slots carry no durations, and the single-voice view was accepted on the mockups.
- **Extend the format now (sixteenths, accents, more instruments)** — rejected: no lesson needs it yet, and v2 can be added without migration (ADR-0050).

## Consequences

- The admin editor is a fixed 3 × 8 grid, and validation is simple.
- The drawing is recognisable to drummers, but not engraving-quality: no voices, no accents, no ghost notes, no open hi-hat.
- Lessons that need more cannot be written down. The seed drops such lessons, and one draft ("Hi-hat foot chicks on 2&4") shows the gap on purpose.

## Debt

- **Shortcut taken:** fixed-size, fixed-meter format with a closed instrument list, drawn as a single voice.
- **Why accepted:** covers the MVP exercises (singles, doubles, paradiddles, basic grooves) with minimal modelling, editing and drawing effort.
- **Risk while open:** content authors hit the limits quickly (sixteenths, hi-hat foot, accents); single-voice drawing looks unusual to experienced readers in busy grooves.
- **Repayment trigger:** the first lesson that needs a different subdivision, meter, length, instrument or articulation, or feedback from test users that the single-voice drawing is hard to read.
- **Repayment sketch:** add a `v2` member to the signature union (meter, subdivision, bar count, an extended instrument enum, optional articulations); give it its own editor and renderer, with two voices; keep `v1` rendering for existing lessons.

# ADR-0052: Draw the notation as a hand-written SVG component instead of using a notation library

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-26
- **Related:** PRD §4.2, US-6, US-17; ADR-0051, ADR-0054; specs/signature; `apps/web`

## Context

Signature v1 (ADR-0051) must be drawn as a drum staff on the lesson page and as a live preview in the admin editor. During play, the drawing must show a count-in overlay and a highlight at the current quarter note, driven by the audio clock (ADR-0054). The content is tiny: 8 slots, 3 staff positions, one voice, no key signature, no ties, no tuplets.

## Decision

The notation is a React component that draws SVG directly. A pure layout function turns a signature into glyph positions: noteheads, stems, beams or flags, rests, comments and counts. The component only renders that output. It uses `currentColor` and theme tokens. No notation library is added.

## Alternatives considered

- **VexFlow** — rejected: a large dependency with its own rendering lifecycle, drum notation needs custom noteheads and staff positions anyway, and overlaying a beat highlight means reaching into its coordinates.
- **abcjs** — rejected: requires converting the signature to ABC text, percussion support is awkward, and theming and overlays are hard to control.
- **OpenSheetMusicDisplay / MusicXML** — rejected: built for full scores, far beyond one bar.

## Consequences

- No new dependency; the drawing is fully themeable and testable through the pure layout function.
- Highlight positions come straight from the same layout as the notes.
- Glyphs (clef, rests, flags) are drawn by hand and look simpler than engraved music.
- A richer format (v2: sixteenths, triplets, two voices) may outgrow hand drawing. That scope should weigh a library again.

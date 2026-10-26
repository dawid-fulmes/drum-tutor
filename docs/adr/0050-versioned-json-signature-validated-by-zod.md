# ADR-0050: Store the signature as versioned JSON validated by a Zod discriminated union

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-26
- **Related:** PRD §4.2, US-6, US-17; ADR-0004, ADR-0005, ADR-0014, ADR-0051; specs/signature; `packages/contracts`, `packages/db` (`lessons.signature`)

## Context

Every lesson needs a signature (PRD §4.2). The MVP format is small and fixed: 8 eighth-note slots, three instruments, a short comment per slot. The product owner expects richer notation later (other meters, sixteenths, more instruments, several bars). They asked for a very simple implementation that can grow without reworking stored lessons. The signature is always read and written as one whole value, and nothing queries inside it.

## Decision

- The signature is one `jsonb` column on `lessons`, `not null`.
- The value carries a format tag: `{ "version": "v1", "slots": [...] }`.
- Its shape is defined only by a Zod schema in `packages/contracts`: `SignatureSchema = z.discriminatedUnion("version", [SignatureV1Schema])`. The API validates every write with it (ADR-0014). The database has no structural check on the JSON.
- A new format is added as a new union member (`"v2"`) with its own renderer and editor. Stored lessons keep their version and are never rewritten.

## Alternatives considered

- **Relational slots (`lesson_signature_slots` with an instrument array per row)** — rejected: every format change becomes a schema migration, and the value is never queried by part.
- **Unversioned JSON** — rejected: a future format change could not tell old values from new ones without guessing from the shape.
- **A JSON Schema check in PostgreSQL** — rejected: a second definition of the format to keep in sync with Zod, while only the API writes lessons.
- **A text notation (ABC, MusicXML)** — rejected: parsing and authoring cost far beyond the 8-slot grid.

## Consequences

- One contract type serves the API, the admin form (ADR-0020) and the renderer.
- Adding a format is additive: a new schema member, a renderer branch and an editor, with no data migration.
- Data written outside the API (manual SQL, seed bugs) is not checked by the database. The seed has a test that parses every signature.
- Each format version must be rendered for as long as lessons use it.

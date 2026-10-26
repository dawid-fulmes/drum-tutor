# ADR-0053: A published lesson must have a signature with at least one note; drafts may have an empty one

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-26
- **Related:** PRD §4.1, §4.2, US-17, US-17a; R11; ADR-0008, ADR-0050; specs/signature

## Context

PRD §4.2 allows an empty instrument list per slot (a rest), so a signature of 8 rests is a valid value. But a lesson whose signature is all rests shows the drummer nothing to play. The PRD does not say whether such a lesson may be saved or published. The admin builds the signature in a grid that starts empty.

## Decision

- Every lesson always has a signature value (ADR-0050). A new lesson starts with 8 rests.
- A **draft** may have an empty signature, so the admin can save work in progress.
- **Publishing** a lesson whose signature has no notes is rejected with `409 SIGNATURE_EMPTY`.
- **Updating** a published lesson to an empty signature is rejected the same way, so "published ⇒ has at least one note" always holds.
- One shared helper, `signatureHasNotes`, defines "has notes" for the API and the UI.

The product owner confirmed this rule in brainstorming.

## Alternatives considered

- **Reject an empty signature on every save** — rejected: forces the admin to fill the grid before saving a draft.
- **Allow publishing an empty signature** — rejected: drummers would see a bar of rests as an exercise.
- **Make the signature nullable until the admin fills it** — rejected: two "empty" states (null and all rests) for the same meaning.

## Consequences

- A new error code `SIGNATURE_EMPTY` (`409`) appears in the API contract (ADR-0022).
- Lessons existing before the migration get an empty signature. Published ones violate the rule until the database is reseeded (ADR-0004).

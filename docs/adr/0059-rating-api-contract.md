# ADR-0059: Rating contract: summary on every lesson, `myRating` and `canRate` on the detail, `PUT` upsert, `409 RATING_REQUIRES_COMPLETION`

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-26
- **Related:** PRD US-2, US-6, US-12, US-13; R3, R4; ADR-0010, ADR-0022, ADR-0031, ADR-0055, ADR-0056; specs/rating

## Context

ADR-0031 kept rating out of the contracts until this scope and expected an additive change. ADR-0010 says the lesson endpoint must tell the client whether the current user may rate and what their current rating is. The frontend must not derive that from other data.

## Decision

- `LessonSummary` gains `rating: { average: number | null, count: number }`. `average` is null exactly when `count` is 0. The library items, the drummer detail and (by inheritance) the admin shapes carry it.
- `LessonDetail` gains `myRating: 1–5 | null` and `canRate: boolean` (the user has at least one practice log of the lesson). They are per user, so they are not on list items.
- `LessonSort` becomes `"rating" | "newest" | "oldest"`, defaulting to `"rating"` (ADR-0058).
- `PUT /api/lessons/:id/rating` with `{ rating }` creates or replaces the current user's rating and answers `200 { rating, myRating }`. It is idempotent for the same value.
- Without a log → `409 RATING_REQUIRES_COMPLETION`. Draft or missing lesson → `404 NOT_FOUND`. There is no `DELETE` (ADR-0056).

This supersedes ADR-0031.

## Alternatives considered

- **`POST` to create and `PATCH` to change** — rejected: the client would need to know whether a rating exists, and R4 makes it one value per user and lesson, which is what `PUT` on a sub-resource means.
- **`403` for a missing completion** — rejected: the user is allowed in general. The lesson state conflicts with the request, which is how the other rule violations (`LESSON_LOCKED`, `SIGNATURE_EMPTY`) are answered.
- **`canRate` and `myRating` on list items too** — rejected: nothing on the cards needs them, and they would add a per-user lookup to every library page.
- **Average as a pre-formatted string** — rejected: formatting belongs to the UI. The API returns a number with two decimals.

## Consequences

- The change is additive except for the default sort.
- The web app unlocks the rating button by refetching the lesson detail after a log is saved, not by inspecting logs.
- The admin shapes carry `rating` without the admin UI using it.

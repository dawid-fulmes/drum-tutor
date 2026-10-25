# ADR-0032: Paginate lists with a 1-based page and page size, returning totals

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD US-2, R13; ADR-0012; specs/lessons-and-tags

## Context

R13 requires a paginated library where filters and sorting apply to the whole result set. The admin lesson list and the tag lists are paginated too. The UI shows classic numbered pagination (library, admin lessons) and infinite scroll (tag picker, admin tags). Every list endpoint needs one shape that serves both.

## Decision

- Requests take `page` (integer ≥ 1, default 1) and `pageSize` (integer 1–100, default 20), defined once as `PaginationQuery` in `packages/contracts`.
- Responses are `Page<T> = { items, page, pageSize, totalItems, totalPages }`, where `totalItems` counts the whole filtered result set and `totalPages = ceil(totalItems / pageSize)` (0 when empty).
- A page past the end is not an error: `200` with empty `items` and the real totals, so the client can move to the last page.
- Every sort order has a unique tie-breaker (the id) so pages are stable.
- Infinite scroll uses the same contract: the next page is `page + 1` while `page < totalPages`.

## Alternatives considered

- **Cursor (keyset) pagination** — rejected: numbered pages and "jump to page N" need offsets and a total count; data volume in the MVP is small.
- **0-based page index** — rejected: the page number goes into the URL and is shown to users, where 1-based reads naturally.
- **`offset` / `limit`** — rejected: the UI thinks in pages; translating in every client is error-prone.

## Consequences

- Each list endpoint runs a count query next to the page query.
- Offset pagination can skip or repeat items if data changes between page loads; acceptable for an admin-curated library.

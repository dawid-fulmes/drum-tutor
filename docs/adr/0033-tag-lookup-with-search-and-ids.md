# ADR-0033: Read tags through one paginated endpoint with server-side name search and lookup by ids

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD US-3, US-16, US-17; ADR-0011, ADR-0012, ADR-0032; specs/lessons-and-tags

## Context

Tags are picked in the library filter and in the lesson form, and listed in the admin. The dictionary can grow, so the picker should not load everything at once. The library keeps selected tag ids in the URL; after a refresh the UI must show their names, and the selected tags may not be on any page the picker has loaded.

## Decision

- `GET /api/tags` is paginated (ADR-0032), sorted by name, and takes `q` for a case-insensitive substring search done in SQL.
- The same endpoint takes `ids` to return exactly those tags in one call; unknown ids are left out. The UI resolves the names of selected tags this way, never by one request per tag.
- The picker uses infinite scroll over this endpoint. The admin list uses `GET /api/admin/tags` with the same query, which adds `lessonCount` to each tag.

## Alternatives considered

- **Return the whole tag dictionary unpaginated and filter in the browser** — rejected by the product owner: search and paging belong to the backend.
- **`GET /api/tags/:id` per selected tag** — rejected: N+1 requests to assemble data the backend can return at once.
- **Echo resolved tags inside the library response** — rejected: couples the library response to the filter UI and does not help the lesson form.

## Consequences

- One endpoint serves three UIs; its query parameters are part of the public contract.
- Stale ids in a URL (e.g. a deleted tag) are detected by their absence in the `ids` response, and the UI removes them.

# ADR-0058: The library is sorted by rating by default

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-26
- **Related:** PRD US-2, US-5; ADR-0012, ADR-0031, ADR-0057; specs/rating, specs/lessons-and-tags

## Context

The library has been sorted newest first by default since `lessons-and-tags`, because rating did not exist (ADR-0031). The PRD lists the sort options but not the default.

## Decision

- The default library sort is by rating (ADR-0057 order).
- Both the API (`LibraryQuery.sort` default) and the web app (the library URL schema's default and fallback) state `rating` explicitly.
- The sort Select lists **Highest rated** first, then **Newest first** and **Oldest first**.

The product owner made this call in brainstorming.

## Alternatives considered

- **Keep newest first as the default** — rejected: the library's purpose is to cut search time (PRD §1), and the best-liked lessons are the best first suggestion.

## Consequences

- A library URL without `sort` now shows a different order than before. Old bookmarks still work.
- While few lessons have ratings, most of the default view is the unrated tail in newest-first order, so it looks almost like the old default.

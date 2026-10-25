# ADR-0021: Show failed mutations as global toasts using Sonner

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** TECH_STACK.md; ADR-0022, ADR-0025; specs/project-foundation

## Context

Every write in the app (login, logging a session, rating, admin edits) can fail on the API. Handling errors per form leads to inconsistent, often missing, feedback. The API returns one error shape (ADR-0022) with a message that is safe to display.

## Decision

Use Sonner (through its shadcn/ui wrapper) as the single toast/snackbar library, mounted once at the app root. The TanStack Query `MutationCache` has a global `onError` that shows a toast with the `ApiError` message for every failed mutation. A mutation can opt out through `meta` when it handles the error inline. Query errors are not toasted globally; they are handled where the data is used (e.g. the router redirects on `401`).

## Alternatives considered

- **react-hot-toast / react-toastify** — rejected: work fine, but Sonner is what shadcn/ui ships and styles, so it matches the rest of the UI with no extra theming.
- **Per-form error handling only** — rejected: inconsistent, and easy to forget.
- **Toasting query errors globally** — rejected: background refetch failures and expected `401`s would produce noise.

## Consequences

- A new mutation gets user-visible error feedback with no extra code.
- Inline field errors from the API (`details`) are not shown by default; forms that need them must opt in.

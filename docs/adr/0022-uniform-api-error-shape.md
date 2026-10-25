# ADR-0022: Return one error response shape for every API error

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** ADR-0014, ADR-0021, ADR-0025; specs/project-foundation

## Context

The frontend must never guess what an API failure looks like (CLAUDE.md). Fastify's default bodies differ between validation errors, 404s and unhandled errors, and they can leak internals.

## Decision

Every non-2xx API response has the body `{ error: { code, message, details? } }`, defined as `ApiErrorSchema` in `packages/contracts`. `code` is a machine-readable string (e.g. `VALIDATION_ERROR`, `UNAUTHENTICATED`, `NOT_FOUND`, `INTERNAL_ERROR`). `message` is human-readable and safe to display. `details` lists field issues (`{ path, message }`) for validation errors. One Fastify error handler and not-found handler produce this shape. Internal errors are logged server-side and returned with a generic message.

## Alternatives considered

- **RFC 9457 Problem Details (`application/problem+json`)** — rejected for now: standard, but its flat field set (`type`, `title`, `detail`) adds ceremony without benefit for a single first-party client. Can be adopted later behind the same contract package.
- **Fastify defaults** — rejected: inconsistent shapes, possible information leaks.

## Consequences

- The web client can parse every error with one schema and show `message` without knowing the endpoint.
- New error codes are added to the contracts package, so they are visible in review.

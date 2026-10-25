# ADR-0025: Use a thin typed fetch client instead of an HTTP library or generated client

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** ADR-0014, ADR-0022; specs/project-foundation

## Context

The web app calls a REST API whose request and response shapes are Zod schemas in `packages/contracts` (ADR-0014). The client needs types, runtime parsing of responses, cookies, and one error type (ADR-0022).

## Decision

Write a small wrapper over `fetch` in `apps/web`. It takes the request and the response Zod schema, sends JSON with `credentials: "include"`, parses successful bodies with the schema, and turns non-2xx responses into a typed `ApiClientError` parsed with `ApiErrorSchema`. If a body does not match the expected schema, it throws; it never fills in or guesses missing fields.

## Alternatives considered

- **ky / axios** — rejected: retries, hooks and interceptors are not needed now; a dependency for a few lines of code.
- **Client generated from OpenAPI (openapi-fetch, orval, hey-api)** — rejected: the Zod schemas are already the source of truth in the same monorepo, so generating types back from OpenAPI would add a codegen step and a second representation of the contract.

## Consequences

- A response that does not match the contract fails loudly in the client, which surfaces backend contract gaps instead of hiding them.
- Endpoint call sites name their schemas explicitly; there is no route-to-schema registry until it is needed.
- A non-2xx response whose body is not an `ApiError` cannot have come from our API, which always answers in that shape. It most likely came from something in between, such as the dev proxy while the API is down. The client reports it as code `UNKNOWN` with the message "Cannot reach the server", without inventing fields. Revisit the message once a production reverse proxy can return its own 413/502/504 pages.

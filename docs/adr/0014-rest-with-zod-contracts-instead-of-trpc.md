# ADR-0014: REST API with shared Zod contracts and generated OpenAPI instead of tRPC

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** TECH_STACK.md; ADR-0013

## Context

Frontend and backend live in one TypeScript monorepo and need shared types and validation. The API contract should be explicit so gaps are visible and reviewable.

## Decision

Define request/response schemas with Zod in `packages/contracts`. The API (REST) validates against them; the web app types its calls with them. OpenAPI is generated from the schemas.

## Alternatives considered

- **tRPC** — rejected: excellent DX but the contract is implicit in router code, harder to review, document and consume from non-TS clients later (e.g. a mobile app).
- **Hand-written OpenAPI + codegen** — rejected: two sources of truth.
- **GraphQL** — rejected: overkill for a small, well-defined set of screens.

## Consequences

- Contract changes are a single, reviewable diff in `packages/contracts`.
- Some boilerplate per endpoint (route + schema registration).

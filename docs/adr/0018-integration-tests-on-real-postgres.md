# ADR-0018: Run API integration tests against real PostgreSQL via Testcontainers

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** TECH_STACK.md; PRD R1–R13

## Context

Most business rules (locking, rating eligibility, AND filtering, stats aggregation by local date, idempotent log creation) live in queries and constraints. Mocked databases do not verify them.

## Decision

API integration tests run with Vitest against a real PostgreSQL started via Testcontainers, with migrations applied. Pure logic stays in fast unit tests.

## Alternatives considered

- **Mocked repositories / in-memory DB** — rejected: would not catch SQL, constraint or aggregation errors where the rules actually live.
- **Shared long-lived test database** — rejected: test isolation and CI reproducibility.

## Consequences

- Docker is required locally and in CI to run integration tests.
- Slower than unit tests; keep them focused on business rules and contracts.

# ADR-0015: Use Fastify instead of NestJS for the backend

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** TECH_STACK.md; ADR-0013, ADR-0014

## Context

The backend is a small REST API over one database with a handful of resources. NestJS is a common default choice for TypeScript backends.

## Decision

Use Fastify with Zod-based validation and OpenAPI generation.

## Alternatives considered

- **NestJS** — rejected: decorators, modules and DI add ceremony that does not pay off at this scale; class-validator style duplicates the Zod contracts.
- **Express** — rejected: weaker typing and schema integration, slower.
- **Hono** — viable; Fastify chosen for maturity of its Node ecosystem and plugins.

## Consequences

- Structure (modules, layering, DI) is our responsibility; conventions must be kept consistent by hand.

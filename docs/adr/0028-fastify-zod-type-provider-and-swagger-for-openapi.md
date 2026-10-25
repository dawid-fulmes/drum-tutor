# ADR-0028: Use fastify-type-provider-zod with @fastify/swagger to validate routes and generate OpenAPI

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** ADR-0014, ADR-0015, ADR-0022; specs/project-foundation (§4.4, §6)

## Context

ADR-0014 requires one set of Zod schemas in `packages/contracts` to drive API validation, TypeScript types and a generated OpenAPI document. The foundation spec left the exact Fastify integration to the builder.

## Decision

- Register `fastify-type-provider-zod`'s `validatorCompiler` and `serializerCompiler` on the app. Routes use `ZodTypeProvider` / `FastifyPluginAsyncZod`, so request bodies are parsed by the contract schema, which also applies transforms such as email normalization. Response bodies are validated against the declared response schemas.
- Generate OpenAPI 3.1 with `@fastify/swagger` using the provider's `jsonSchemaTransform`, and serve it with `@fastify/swagger-ui` at `/api/docs` (JSON at `/api/docs/json`).
- Every route declares its success and error responses. Errors use `ApiErrorSchema` (ADR-0022).

## Alternatives considered

- **Hand-written JSON Schema / TypeBox** — rejected: it would add a second schema language next to the Zod contracts.
- **zod-to-openapi with a separately maintained registry** — rejected: the document could drift from what the routes actually validate.
- **Validating inside handlers with `schema.parse`** — rejected: no OpenAPI, no typed `request.body`, and every route repeats the same code.

## Consequences

- A route's schema block is its contract: validation, types and docs cannot disagree.
- A response that does not match its schema becomes a 500 (`INTERNAL_ERROR`) instead of reaching the client with the wrong shape.
- Fastify's own validation errors are mapped to `VALIDATION_ERROR` through `hasZodFastifySchemaValidationErrors` in the error handler.

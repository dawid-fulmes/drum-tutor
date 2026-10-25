# ADR-0020: Use TanStack Form for forms, validated with contract Zod schemas

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** TECH_STACK.md; ADR-0014; specs/project-foundation

## Context

The SPA needs forms: the login form now, and later the admin lesson editor with its 8-slot signature builder, tag pickers and range-limited tempo and duration fields. Validation rules already live as Zod schemas in `packages/contracts` (ADR-0014). The rest of the frontend data layer is TanStack (Router, Query).

## Decision

Use TanStack Form for all forms. Field and form validation use the Zod schemas from `packages/contracts` directly, so the client validates with exactly the same rules the API enforces. Pending state is driven by the TanStack Query mutation: while pending, fields and submit are disabled and the submit button shows a spinner.

## Alternatives considered

- **React Hook Form + zodResolver** — rejected: mature and what shadcn/ui's form examples use, but it is a separate state model next to TanStack Router/Query. TanStack Form gives stronger field-level typing for nested arrays such as the signature slots.
- **Plain controlled inputs** — rejected: fine for one email field, but would not scale to the lesson editor and would not set a reusable pattern.

## Consequences

- shadcn/ui form examples (built for React Hook Form) cannot be copied directly; we keep our own small form-field wrapper around shadcn inputs.
- Client validation can never be stricter or looser than the API, because both use the same schema. The API remains the authority.

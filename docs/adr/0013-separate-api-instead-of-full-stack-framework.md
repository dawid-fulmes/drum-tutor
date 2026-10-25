# ADR-0013: Separate backend API and SPA instead of a full-stack framework

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** TECH_STACK.md; ADR-0014, ADR-0015

## Context

The MVP's value is in business rules (lesson locking, rating eligibility, day attribution, stats aggregation). The practice player is purely client-side, so server rendering adds nothing.

## Decision

Build two apps in the monorepo: `apps/api` (backend that owns and enforces all business rules) and `apps/web` (React + Vite SPA, including `/admin`). The frontend never works around API gaps; missing data or behavior is raised as a backend gap.

## Alternatives considered

- **Next.js full-stack (server actions / route handlers)** — rejected: faster start, but blurs the frontend/backend boundary and invites business logic in UI code.
- **Separate repositories** — rejected: shared contracts and atomic changes are simpler in one monorepo.

## Consequences

- Two deployables and a CORS/proxy setup for local dev.
- A shared contract package is required (ADR-0014).

# Drum Tutor — Tech Stack

Companion to [PRD.md](PRD.md). Describes the technology choices for the MVP and the reasoning behind them.

## Principles

- **TypeScript everywhere**, in a single monorepo.
- **Explicit API contract.** Frontend and backend share one schema source; the backend owns and enforces all business rules (R1–R13). The frontend never compensates for gaps in the API.
- **Boring, lightweight tools.** The MVP validates business logic; avoid framework ceremony.

## Overview

| Area | Choice |
|---|---|
| Runtime | Node.js 24 LTS |
| Package manager / monorepo | pnpm workspaces + Turborepo |
| Shared contract | Zod schemas in `packages/contracts`, OpenAPI generated from them |
| Backend | Fastify (REST) with Zod validation |
| Database | PostgreSQL + Drizzle ORM (migrations in TypeScript) |
| Frontend | React + Vite (SPA), TanStack Router, TanStack Query |
| UI | Tailwind CSS + shadcn/ui; Recharts for the stats chart |
| Metronome | Web Audio API (no audio library) |
| Lint / format | Biome |
| Tests | Vitest (unit + API integration on real Postgres via Testcontainers), Playwright (e2e) |
| Local infra | Docker Compose (PostgreSQL) |

## Repository layout

```
apps/
  web/          React SPA: drummer app + /admin panel (route in the same app)
  api/          Fastify REST API
packages/
  contracts/    Zod schemas and shared types (request/response DTOs, enums, signature shape)
  db/           Drizzle schema, migrations, seed data (e.g. singles on pad, money beat)
  config/       Shared tsconfig presets
biome.json      Root Biome config (lint + format for the whole repo)
turbo.json
pnpm-workspace.yaml
docker-compose.yml
```

## Decisions and rationale

### Monorepo: pnpm + Turborepo
Standard TypeScript monorepo setup. pnpm workspaces link packages; Turborepo orchestrates `build`, `test`, `lint`, `typecheck` with caching.

### Contract: Zod in `packages/contracts`
One source of truth for validation and types on both sides. The API validates input/output against the same schemas the web app uses to type its calls. OpenAPI is generated from the schemas so the contract stays explicit and reviewable — missing or thin endpoints are visible as contract gaps, not hidden in frontend code.

### Backend: Fastify (REST)
Lightweight and fast, first-class Zod/OpenAPI integration. REST over tRPC to keep an explicit, documentable contract. NestJS rejected as too much ceremony for this scope.

All business rules live here: lesson locking once logs exist, draft/publish transitions, rating eligibility, tag AND-filtering, stats aggregation, day attribution of logs.

### Database: PostgreSQL + Drizzle
Stats are aggregations by day and tag, which Drizzle expresses close to SQL. Durations are stored in seconds. Each log stores both the UTC timestamp and the user's local calendar date at completion (R12), so stats never shift after the fact.

### Frontend: React + Vite SPA
Lesson playback is purely client-side, so SSR adds nothing. TanStack Router for type-safe routing (incl. `/admin`), TanStack Query for server state. Next.js rejected: it would blur the frontend/backend boundary the PRD relies on.

### UI: Tailwind + shadcn/ui + Recharts
Fast to build admin forms, the library list and the single stats chart.

### Metronome: Web Audio API
Clicks are scheduled ahead on the audio clock (look-ahead scheduler), giving stable tempo independent of UI thread jitter. Accent on beat 1, 4-click count-in not counted toward duration. No audio library (e.g. Tone.js) needed for quarter-note clicks.

### Lint / format: Biome
Single tool for linting and formatting, one root `biome.json`, replaces ESLint + Prettier. Run via `pnpm lint` / `pnpm format` at the root.

### Tests
- **Vitest** for unit tests and API integration tests against a real PostgreSQL (Testcontainers) — business rules are tested on the real database, not mocks.
- **Playwright** for end-to-end flows (login by email, complete a lesson, rate, view stats, admin create/publish).

## Out of scope for MVP

- Authentication / authorization (email-only login, open `/admin` — see PRD).
- Deployment pipeline and hosting choice — decided when MVP moves beyond internal testing.
- Offline support / PWA.

# ADR-0017: Use Biome for linting and formatting

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** TECH_STACK.md

## Context

The monorepo needs consistent linting and formatting across all packages.

## Decision

Use Biome with a single root `biome.json`, exposed as root `pnpm lint` and `pnpm format` scripts.

## Alternatives considered

- **ESLint + Prettier** — rejected: two tools, more config and plugins to maintain, slower.

## Consequences

- Some ESLint plugin rules (e.g. framework-specific ones) may be unavailable; accept or revisit if a concrete need appears.

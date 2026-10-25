# ADR-0026: Run only PostgreSQL in Docker, the apps on the host, and give agents one repo skill to run them

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** TECH_STACK.md; ADR-0018; specs/project-foundation

## Context

Both humans and agents (Claude Code, including for Playwright-driven e2e checks) must be able to start the app locally in a predictable way. Instructions that are not run tend to drift, and an agent that guesses ports or readiness wastes time and produces flaky results.

## Decision

- Docker Compose runs only PostgreSQL. The API and web app run on the host through `pnpm dev`, on fixed ports (API 3330, web 5330 with `strictPort`). Vite proxies `/api` to the API.
- A repo-local skill, `.claude/skills/local-dev/SKILL.md`, tells agents how to check prerequisites, start the app in the background, wait for readiness via `GET /api/health` through the web proxy, reuse an already running instance, stop it, and reset data.
- The README and the skill use the same root `pnpm` scripts; any helper script lives in the repo and is shared by both.

## Alternatives considered

- **Whole stack in Docker Compose** — rejected for dev: slower feedback (file watching through volumes, rebuilds), and no deployment target exists yet to match.
- **No skill; agents read the README** — rejected: the README is written for humans and does not cover background start, readiness polling or reuse of a running instance.

## Consequences

- Developers need Node (via `.nvmrc`), pnpm (via corepack) and Docker on the host.
- A busy port makes startup fail instead of silently moving the app to another port.
- Changing a run command means updating the README and the skill in the same change.

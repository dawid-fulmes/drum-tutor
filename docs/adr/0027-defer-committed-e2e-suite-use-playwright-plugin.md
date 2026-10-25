# ADR-0027: Defer a committed Playwright e2e suite; agents verify the UI through the Playwright plugin

- **Type:** tech-debt
- **Status:** open
- **Date:** 2026-10-25
- **Related:** TECH_STACK.md "Tests"; ADR-0026; specs/project-foundation

## Context

TECH_STACK.md plans Playwright for end-to-end flows. The foundation scope only has login and logout, and there is no CI to run a suite. Agents still need to check UI flows in a real browser.

## Decision

The repo does not contain a Playwright dependency, browser downloads or an e2e test suite for now. Agents verify UI flows by driving the locally running app (started through the `local-dev` skill, ADR-0026) with the Playwright plugin / MCP server in Claude Code. The skill documents the base URL and the flows to check, but the browser tooling lives on the agent's side, not in the repo.

## Alternatives considered

- **`@playwright/test` in the repo with a smoke test from day one** — rejected for now: adds a dependency and a few hundred MB of browsers to setup, for a flow that integration tests already cover at the API level.

## Consequences

- No `pnpm test:e2e` script. `pnpm test` covers unit and API integration tests only.
- UI regressions are caught only when someone (human or agent) checks them manually.
- An agent without the Playwright plugin can start the app but cannot drive the UI.

## Debt

- **Shortcut taken:** no committed, repeatable e2e tests.
- **Why accepted:** keeps the foundation lean while UI flows carry no business rules.
- **Risk while open:** UI regressions in later features go unnoticed between manual checks.
- **Repayment trigger:** whichever comes first: the first feature whose business rules are enforced through a UI flow (the practice session player, logging on completion, R1/R2), or the introduction of CI.
- **Repayment sketch:** add `@playwright/test` in a dedicated workspace with `pnpm test:e2e`, a fixture that starts the app the same way as the `local-dev` skill, and specs for login, practice completion and rating.

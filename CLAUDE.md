# Drum Tutor

App for drummers: a library of single-bar exercises with a metronome player, ratings, and per-tag practice-volume stats.

## Source of truth

- Product requirements: [docs/PRD.md](docs/PRD.md) — business rules R1–R13, user stories US-#.
- Tech stack: [docs/TECH_STACK.md](docs/TECH_STACK.md).
- Decisions and tech debt: [docs/adr/](docs/adr/README.md).
- Specs and implementation plans: [docs/specs/](docs/specs/README.md).

Read the relevant PRD rules and the ADR index before designing or changing anything. If a task conflicts with the PRD or an accepted ADR, stop and ask — do not silently diverge.

## Decision records (mandatory)

Write an ADR in `docs/adr/` (template: `0000-template.md`, conventions: `README.md`) in the same change whenever you:

- choose or replace a library, framework, tool, or infrastructure component;
- define or change a data model, API contract shape, or cross-package boundary;
- interpret an ambiguous PRD rule or make a product call the PRD does not cover;
- reject an approach that a future reader would reasonably expect us to have used.

Record **tech debt** (`Type: tech-debt`) whenever you knowingly take a shortcut: skipped validation, missing auth/permissions, a hardcoded value, a known edge case left unhandled, a test intentionally omitted, a TODO left in code. Every debt record needs a concrete repayment trigger. A `TODO` in code must reference its ADR (`// TODO(ADR-0007): ...`).

Rules:

- Accepted ADRs are immutable — supersede, don't edit (status line excepted).
- Update the index in `docs/adr/README.md` in the same change.
- At the end of a task, list the ADRs you created or changed in your summary. If you made a decision or took a shortcut without recording it, that task is not done.

## Specs and plans (mandatory)

Non-trivial work goes spec → plan → execution (superpowers `brainstorming` → `writing-plans` → execution skills). Conventions: [docs/specs/README.md](docs/specs/README.md).

- Save every spec and plan under `docs/specs/<scope>/` — `<scope>` is a kebab-case name of the feature, epic or subsystem. The spec is `spec.md`; plans are `plan.md` or `plan-NN-<slug>.md`.
- This overrides the skills' default paths: never write to `docs/superpowers/`, date-prefixed files, scratch directories, or anywhere outside the repo.
- Specs and plans are tracked in git. Never add them to `.gitignore` or leave them out of the change they belong to; commit them on the feature branch for that scope, not directly to `main`.
- No plan before the spec is `approved`; no code before the plan is `approved`.
- During execution, tick plan checkboxes and update status lines in the same change as the code they track.
- Changing an approved spec: edit in place, add a dated `## Changelog` entry, update the affected plans.
- Keep the index in `docs/specs/README.md` up to date in the same change.

## Conventions

- Code, docs, commit messages and test data in English.
- TypeScript monorepo (pnpm + Turborepo); Biome for lint and format.
- Business rules are enforced by the backend; the frontend never works around API gaps — record the gap and raise it.

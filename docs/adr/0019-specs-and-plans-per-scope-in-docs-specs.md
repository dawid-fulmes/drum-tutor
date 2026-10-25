# ADR-0019: Keep specs and plans per scope in docs/specs, tracked in git

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** docs/specs/README.md, CLAUDE.md

## Context

Implementation is driven by the superpowers workflow: a design spec (`brainstorming`), then implementation plans (`writing-plans`), then execution. By default the skills write specs to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` and plans to `docs/superpowers/plans/YYYY-MM-DD-<feature>.md` — two separate trees keyed by date. A spec and the plans that implement it end up far apart, and nothing requires them to stay in the repo or reflect execution progress.

## Decision

- Specs and plans live together in one directory per scope: `docs/specs/<scope>/spec.md` and `docs/specs/<scope>/plan.md` (or `plan-NN-<slug>.md` when split).
- They are tracked in git, never kept in ignored paths, scratch directories or outside the repo.
- Plan checkboxes and status lines are updated in the same change as the code they track, so the git history shows what was planned and what was done.
- This overrides the superpowers default paths; `docs/superpowers/` is not used.
- Conventions (headers, statuses, lifecycle, index) are in `docs/specs/README.md`.

## Alternatives considered

- **Superpowers defaults (`docs/superpowers/specs` + `docs/superpowers/plans`)** — rejected: a spec and its plans are separated and linked only by date-prefixed names.
- **Keeping plans out of git (scratch / ignored)** — rejected: loses the record of what was planned versus built, and plans cannot be reviewed alongside the code.

## Consequences

- Every skill invocation that writes a spec or plan must be pointed at `docs/specs/<scope>/`; CLAUDE.md states this so it overrides skill defaults.
- Execution commits touch the plan file as well as the code.
- Changing an approved spec happens in place with a changelog section, unlike ADRs, which are immutable.

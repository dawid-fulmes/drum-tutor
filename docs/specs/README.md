# Specs and plans

Design specs and implementation plans produced by the superpowers workflow (`brainstorming` → `writing-plans` → execution). They are versioned in git next to the code they describe. See [ADR-0019](../adr/0019-specs-and-plans-per-scope-in-docs-specs.md).

## Layout

One directory per scope — a feature, epic, subsystem, or any coherent unit of work:

```
docs/specs/
  <scope>/
    spec.md                  # the design: what and why, contracts, constraints
    plan.md                  # the implementation plan, when one plan covers the scope
    plan-01-<slug>.md        # or numbered plans, when the scope is split
    plan-02-<slug>.md
```

- `<scope>` is kebab-case and names the work, not the date (e.g. `mvp-technical-design`, `practice-stats`).
- One `spec.md` per scope. Plans in the same directory implement that spec.
- Split into numbered plans when the spec covers independent parts; each plan must produce working, testable software on its own.

## Headers

`spec.md` starts with:

```markdown
# <Scope title> — Spec

- **Status:** draft | approved | implemented | superseded by <scope>
- **Date:** YYYY-MM-DD
- **Related:** PRD rules (R#, US-#), ADRs (ADR-NNNN)
- **Plans:** plan.md | plan-01-<slug>.md, …
```

Each plan uses the `writing-plans` header, with **Spec:** pointing at `spec.md` in the same directory, plus a status line:

```markdown
- **Status:** draft | approved | in progress | done
```

## Lifecycle

1. **Spec** — written as `draft`, becomes `approved` only after explicit approval. No plan before an approved spec.
2. **Plan** — written against the approved spec; `approved` after review.
3. **Execution** — task checkboxes (`- [ ]` → `- [x]`) and the plan status are updated as work progresses, in the same change as the code they track.
4. **Done** — when all plans are `done`, the spec becomes `implemented`.

Changing an approved spec: edit it, add a dated entry to a `## Changelog` section at the end, and update affected plans. Decisions inside a spec still need ADRs (see [CLAUDE.md](../../CLAUDE.md)); the spec links to them instead of restating their rationale.

## Index

| Scope                                            | Spec status | Plans                                                                                                                                                                                                             |
| ------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [project-foundation](project-foundation/spec.md) | implemented | [plan.md](project-foundation/plan.md) (done)                                                                                                                                                                      |
| [lessons-and-tags](lessons-and-tags/spec.md)     | implemented | [plan-01-backend.md](lessons-and-tags/plan-01-backend.md) (done), [plan-02-admin-ui.md](lessons-and-tags/plan-02-admin-ui.md) (done), [plan-03-library-ui.md](lessons-and-tags/plan-03-library-ui.md) (done)      |
| [practice-and-stats](practice-and-stats/spec.md) | implemented | [plan-01-backend.md](practice-and-stats/plan-01-backend.md) (done), [plan-02-player-ui.md](practice-and-stats/plan-02-player-ui.md) (done), [plan-03-stats-ui.md](practice-and-stats/plan-03-stats-ui.md) (done)  |
| [signature](signature/spec.md)                   | implemented | [plan-01-backend.md](signature/plan-01-backend.md) (done), [plan-02-notation-and-player.md](signature/plan-02-notation-and-player.md) (done), [plan-03-admin-editor.md](signature/plan-03-admin-editor.md) (done) |

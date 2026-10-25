# Architecture Decision Records

This directory records significant decisions and deliberately accepted technical debt.

## Conventions

- One file per record: `NNNN-kebab-case-title.md`, numbered sequentially (`0001`, `0002`, …). Never reuse a number.
- Start from [0000-template.md](0000-template.md).
- Two types:
  - **decision** — an architectural, technical or product-rule choice that is hard or costly to reverse.
  - **tech-debt** — a shortcut taken knowingly; must state a repayment trigger.
- Accepted records are immutable. To change a decision, write a new ADR and mark the old one `superseded by ADR-XXXX`. The only allowed edit to an accepted record is its status line.
- Repaying debt = a new ADR describing the proper solution; the debt record's status becomes `repaid in ADR-XXXX`.
- Keep the index below up to date in the same change that adds or changes a record.

## Index

| ADR | Title | Type | Status |
|---|---|---|---|
| [0001](0001-email-only-identification-without-authentication.md) | Identify users by email only, without authentication | tech-debt | open |
| [0002](0002-open-admin-panel-without-access-control.md) | Leave the admin panel open without access control | tech-debt | open |
| [0003](0003-lock-lessons-once-practiced.md) | Lock lessons against edit and delete once they have practice logs | tech-debt | open |
| [0004](0004-disposable-mvp-data.md) | Treat MVP data as disposable | tech-debt | open |
| [0005](0005-single-bar-eighth-note-signature.md) | Limit the exercise signature to one 4/4 bar of eighth notes and three instruments | tech-debt | open |
| [0006](0006-attribute-full-duration-to-every-tag.md) | Attribute a log's full duration to every tag of its lesson | decision | accepted |
| [0007](0007-fix-log-day-at-completion-local-date.md) | Fix a log's day at completion using the user's local date | decision | accepted |
| [0008](0008-lesson-lifecycle-draft-published.md) | Lesson lifecycle — draft, published, back to draft only without logs | decision | accepted |
| [0009](0009-log-only-completed-sessions.md) | Log only sessions that run to the end | decision | accepted |
| [0010](0010-rating-requires-completion.md) | Allow rating only after completing a lesson, one editable rating per user | decision | accepted |
| [0011](0011-admin-managed-tag-dictionary.md) | Manage tags as an admin dictionary with rename-always, delete-if-unused | decision | accepted |
| [0012](0012-library-filter-and-sort-semantics.md) | Library filter and sort semantics | decision | accepted |
| [0013](0013-separate-api-instead-of-full-stack-framework.md) | Separate backend API and SPA instead of a full-stack framework | decision | accepted |
| [0014](0014-rest-with-zod-contracts-instead-of-trpc.md) | REST API with shared Zod contracts and generated OpenAPI instead of tRPC | decision | accepted |
| [0015](0015-fastify-instead-of-nestjs.md) | Use Fastify instead of NestJS for the backend | decision | accepted |
| [0016](0016-web-audio-metronome-without-library.md) | Implement the metronome on the Web Audio API without an audio library | decision | accepted |
| [0017](0017-biome-for-lint-and-format.md) | Use Biome for linting and formatting | decision | accepted |
| [0018](0018-integration-tests-on-real-postgres.md) | Run API integration tests against real PostgreSQL via Testcontainers | decision | accepted |

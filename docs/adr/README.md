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
| — | — | — | — |

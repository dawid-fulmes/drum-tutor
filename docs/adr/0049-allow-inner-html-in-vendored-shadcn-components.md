# ADR-0049: Allow `dangerouslySetInnerHTML` in vendored shadcn components

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** ADR-0017, ADR-0037, ADR-0046; specs/practice-and-stats (plan 03)

## Context

ADR-0037 keeps the generated `apps/web/src/components/ui/**` files exactly as the shadcn CLI produces them and turns off, for that folder only, the Biome rules the stock code violates. The stock `chart` component added for the stats screen (ADR-0046) writes its theme colours as CSS custom properties into a `<style>` element through `dangerouslySetInnerHTML`, which Biome's `security/noDangerouslySetInnerHtml` reports as an error.

## Decision

Turn off `security/noDangerouslySetInnerHtml` in the existing Biome override for `apps/web/src/components/ui/**`. The rule stays on everywhere else. `chart.tsx` stays unedited.

## Alternatives considered

- **A `biome-ignore` comment in `chart.tsx`** — rejected: it is a hand edit of a generated file, lost on every regeneration, against ADR-0037.
- **Rewrite the component without the `<style>` element** — rejected: a fork of a stock component for no functional gain.

## Consequences

- The injected CSS comes only from the static `ChartConfig` in our code (colour tokens), never from user input, so there is no XSS path today.
- Any future component in `components/ui/**` that sets inner HTML is no longer flagged; reviewers of shadcn additions must check what it injects.

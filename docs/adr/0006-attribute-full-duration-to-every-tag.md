# ADR-0006: Attribute a log's full duration to every tag of its lesson

- **Type:** decision
- **Status:** accepted
- **Date:** 2026-10-25
- **Related:** PRD R6, US-14, §5.6; ADR-0003

## Context

Statistics show minutes practiced per day per tag. Lessons can have several tags (e.g. singles = "hand speed" + "rudiments"), so a rule is needed for how one log's time is counted across tags.

## Decision

Each log counts its full duration toward every tag of its lesson. A 4-minute session on a lesson with two tags adds 4 minutes to each tag.

## Alternatives considered

- **Split duration evenly between tags** — rejected: understates practice per skill; a drummer practicing singles really did train hand speed for 4 minutes.
- **Primary tag only** — rejected: requires an extra concept and hides secondary skills.

## Consequences

- The sum over tags may exceed the real total practice time. This is intended, not a bug; a future "total time" stat must be computed from logs, not by summing tags.
- Stats depend on the lesson's tags, which is why practiced lessons are locked (ADR-0003).

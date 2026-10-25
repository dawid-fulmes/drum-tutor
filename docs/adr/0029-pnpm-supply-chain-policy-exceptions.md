# ADR-0029: Accept pnpm 12 supply-chain policy exceptions for pinned fresh releases and build scripts

- **Type:** tech-debt
- **Status:** open
- **Date:** 2026-10-25
- **Related:** TECH_STACK.md; `pnpm-workspace.yaml`; specs/project-foundation

## Context

pnpm 12 enforces two supply-chain policies by default:

- **Minimum release age.** Very recently published versions are refused unless they are excluded explicitly.
- **Blocked install scripts.** Install fails on any dependency with an install script that has not been approved.

The foundation scope pins versions checked against the registry on 2026-10-25. Some of them, such as Biome 2.6.3 and its platform binaries, were newer than the age gate.

## Decision

- **Release age.** Keep the `minimumReleaseAgeExclude` entries pnpm added for the exactly pinned Biome 2.6.3 packages.
- **Install scripts (`allowBuilds`):**
  - allow `esbuild`. Its postinstall fetches the native binary that `tsx` and `drizzle-kit` need.
  - deny `cpu-features`, `ssh2` and `protobufjs`. These are optional native or postinstall steps pulled in transitively by Testcontainers and are not needed here.

## Alternatives considered

- **Pin older versions that pass the age gate** — rejected for now: the plan had already verified the pinned versions, and the gate's purpose (avoiding compromised fresh releases) is weaker for exact pins of a well-known tool.
- **Turn the policies off globally** — rejected: they protect every future dependency, not just these.

## Consequences

- Updating Biome means updating or removing these exclusions.
- Testcontainers' SSH transport runs without its optional native crypto acceleration; we do not use it.

## Debt

- **Shortcut taken:** we bypass the release-age gate for specific fresh versions.
- **Why accepted:** keeps the verified pins without waiting for the gate to expire.
- **Risk while open:** a compromised release of an excluded version would not be held back by the gate.
- **Repayment trigger:** the next dependency update touching Biome, or 2026-11-25, whichever comes first.
- **Repayment sketch:** remove `minimumReleaseAgeExclude` entries once those versions are older than the gate, and re-run `pnpm install` to confirm the lockfile passes the policies without exceptions.

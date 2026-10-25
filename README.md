# Drum Tutor

An app for drummers. It offers a library of single-bar exercises with a metronome player, ratings, and per-tag practice-volume stats.

- Product requirements: [docs/PRD.md](docs/PRD.md)
- Tech stack: [docs/TECH_STACK.md](docs/TECH_STACK.md)
- Decisions and tech debt: [docs/adr/](docs/adr/README.md)
- Specs and implementation plans: [docs/specs/](docs/specs/README.md)

The repo is a TypeScript monorepo (pnpm + Turborepo):

| Path | What |
|---|---|
| `apps/web` | React SPA (Vite, TanStack Router/Query/Form, Tailwind + shadcn/ui) |
| `apps/api` | Fastify REST API |
| `packages/contracts` | Zod schemas shared by API and web (the API contract) |
| `packages/db` | Drizzle schema, migrations, DB client |
| `packages/config` | Shared tsconfig presets |

## Prerequisites

- [nvm](https://github.com/nvm-sh/nvm). Node itself is installed from `.nvmrc` (Node 24).
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or another Docker daemon), running.

pnpm does not need a separate install. Corepack, which ships with Node, provides the exact pnpm version pinned in `package.json`.

On first use, corepack asks `Corepack is about to download … pnpm … Do you want to continue? [Y/n]`. Answer `Y`. During `pnpm install`, pnpm may print "Agent skills awaiting approval" for some TanStack packages; that is informational and you can ignore it.

## First-time setup

Run these from the repo root:

```bash
nvm install          # installs the Node version from .nvmrc
nvm use
corepack enable      # makes the pinned pnpm available
pnpm install
cp .env.example .env
pnpm db:up           # starts PostgreSQL in Docker and waits until it is healthy
pnpm db:migrate
pnpm dev             # API + web in watch mode; stop with Ctrl+C
```

Then open http://localhost:5330 and log in with any email. A new email creates a user automatically. There is no password; see [ADR-0001](docs/adr/0001-email-only-identification-without-authentication.md).

In a new terminal, run `nvm use` again before using `pnpm`.

## URLs

| What | URL |
|---|---|
| Web app | http://localhost:5330 |
| API | http://localhost:3330/api (the web dev server also proxies `/api` to it) |
| OpenAPI docs | http://localhost:3330/api/docs |
| Health | http://localhost:5330/api/health (through the proxy, checks web → API → DB) |
| PostgreSQL | `localhost:5442` (see `.env`) |

The ports are deliberately non-standard so that they don't clash with other local projects. They are fixed: if a port is taken, startup fails instead of moving to another port.

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Run API and web in watch mode (foreground) |
| `pnpm dev:start` | Start everything (DB, migrations, API, web) in the background and wait until healthy |
| `pnpm dev:stop` | Stop the background API and web (the DB keeps running) |
| `pnpm db:up` | Start PostgreSQL via Docker Compose and wait until it is healthy |
| `pnpm db:down` | Stop the database container (data kept) |
| `pnpm db:reset` | Drop all data, start fresh and migrate |
| `pnpm db:migrate` | Apply Drizzle migrations |
| `pnpm db:generate` | Generate a migration from schema changes in `packages/db/src/schema.ts` |
| `pnpm lint` | Lint and format check (Biome) |
| `pnpm format` | Format and apply safe fixes (Biome) |
| `pnpm typecheck` | Type-check every package |
| `pnpm test` | All tests: unit tests and API integration tests |
| `pnpm build` | Build all apps (sanity check, no deployment) |

## Tests

```bash
pnpm test
```

- Unit tests run with Vitest.
- API integration tests run against a real PostgreSQL that Testcontainers starts automatically, so **Docker must be running**. They do not use or touch your dev database.
- There is no committed end-to-end suite yet ([ADR-0027](docs/adr/0027-defer-committed-e2e-suite-use-playwright-plugin.md)).

## Lint and format

```bash
pnpm lint      # check only
pnpm format    # write fixes
```

Biome covers TypeScript, JSON and CSS. Markdown is not formatted.

## Resetting data

MVP data is disposable ([ADR-0004](docs/adr/0004-disposable-mvp-data.md)):

```bash
pnpm db:reset
```

If you were logged in, reload the page: the app finds that your user is gone and sends you back to the login screen.

## Working with agents

Claude Code agents start, check and stop the app through the repo skill [`.claude/skills/local-dev`](.claude/skills/local-dev/SKILL.md). It uses the same commands as this README, through `scripts/dev-start.sh` / `scripts/dev-stop.sh` and `scripts/with-node.sh`, which selects the Node version from `.nvmrc` for each command.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `nvm: command not found` | Install nvm and open a new terminal. |
| `pnpm: command not found` | Run `nvm use` and then `corepack enable`. |
| `Unsupported engine` / wrong Node version | Run `nvm use` in the repo root (Node 24 is required). |
| `pnpm db:up` fails with `Cannot connect to the Docker daemon` | Start Docker Desktop and retry. |
| `pnpm db:up` fails with `port is already allocated` | Another PostgreSQL uses port 5442. Set a free `POSTGRES_PORT` in `.env` and use the same port in `DATABASE_URL`. |
| `Port 5330 is already in use` (web) or `EADDRINUSE … 3330` (API) | Another process holds the port. If it is an earlier background run, use `pnpm dev:stop`; otherwise stop that process. |
| `Invalid environment variables` when the API starts | `.env` is missing or incomplete. Copy `.env.example` to `.env` again. |
| `pnpm test` fails with a Docker or Testcontainers error | Docker is not running. Start it and retry. |

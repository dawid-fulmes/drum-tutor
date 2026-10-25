# Project Foundation — Spec

- **Status:** implemented
- **Date:** 2026-10-25
- **Related:** PRD US-1, §3 Identification; ADR-0001, ADR-0004, ADR-0013, ADR-0014, ADR-0015, ADR-0017, ADR-0018, ADR-0020 – ADR-0029
- **Plans:** [plan.md](plan.md)

## 1. Intent

This is the first scope of the MVP. It sets up the base that every later feature builds on. It proves that the whole stack works end to end on one small feature: logging in by email with automatic account creation (US-1).

The feature is deliberately small. What matters more is the **pattern** it establishes. Every later MVP feature should follow the same path, already wired and proven here:

> Zod contract in `packages/contracts` → Fastify route validated by that contract → Drizzle schema and migration in `packages/db` → typed call from the SPA through TanStack Query → TanStack Form with the same Zod schema → integration test on real PostgreSQL.

There are two audiences, and both matter equally:

- **A human developer** clones the repo and follows `README.md` to a running app. Every instruction in the README is actually executed and verified on a clean state as part of this scope.
- **An agent** (Claude Code) uses a skill committed in the repo to start, check and stop the app predictably, e.g. to drive the UI with the Playwright plugin for e2e checks, without guessing ports, order of steps or readiness.

## 2. Goals, non-goals, anti-goals

**Goals**

- Monorepo skeleton exactly as in [TECH_STACK.md](../../TECH_STACK.md) "Repository layout": `apps/web`, `apps/api`, `packages/contracts`, `packages/db`, `packages/config`, root `biome.json`, `turbo.json`, `pnpm-workspace.yaml`, `docker-compose.yml`.
- `.nvmrc` pinning Node 24, plus pnpm pinned through `packageManager` and corepack.
- PostgreSQL in Docker Compose. A `users` table created by a Drizzle migration.
- API: email login that finds or creates the user, current-user lookup, logout. Session survives a browser refresh.
- Web: login screen and a logged-in placeholder screen with logout. HTTP client, TanStack Query, TanStack Router, TanStack Form, global error toasts and loading states are all set up as reusable infrastructure.
- OpenAPI generated from the Zod contracts and served by the API.
- Root scripts for dev, lint, format, typecheck and tests. Backend test setup with integration tests for user creation, login and logout.
- A verified `README.md` and a repo-local agent skill for running the app.
- `TECH_STACK.md` updated with libraries chosen in this scope, each backed by an ADR.

**Non-goals (this scope)**

- Any domain beyond users: no lessons, tags, logs, ratings or stats. No `/admin` route yet.
- CI. There is no pipeline. Lint and test commands exist locally only.
- Frontend unit tests and their setup.
- A committed Playwright e2e suite, a Playwright dependency in the repo and `pnpm test:e2e` (ADR-0027). Agents verify the UI with the Playwright plugin / MCP server in Claude Code against the app started by the skill.
- Production build, deployment or hosting. Containerizing the API or web app.
- Real authentication (ADR-0001 stays open).
- Designed UI. Screens are minimal and functional; PRD §7 says visual design comes later.

**Anti-goals** — the scope fails if any of these happen, even if it "works"

- The README or the skill contains a command that was not actually run and verified.
- The README and the skill describe different ways to start the app, so one of them can silently drift.
- The frontend compensates for a missing or thin API shape instead of the contract being fixed (CLAUDE.md, ADR-0013).
- Types between web and API are duplicated by hand instead of coming from `packages/contracts`.
- Integration tests run against mocks instead of real PostgreSQL (ADR-0018).
- `Jan@x.com` and `jan@x.com` end up as two different users.

## 3. Constraints

- Everything in [TECH_STACK.md](../../TECH_STACK.md) and the accepted ADRs applies, in particular: pnpm workspaces + Turborepo, Fastify REST (ADR-0015), Zod contracts with generated OpenAPI (ADR-0014), Drizzle + PostgreSQL, React + Vite SPA with TanStack Router and Query, Tailwind + shadcn/ui, Biome only (ADR-0017), and Vitest + Testcontainers for API integration tests (ADR-0018).
- Node 24 LTS. The developer's machine currently has Node 22 via nvm and no pnpm. The README must cover getting from there to a working setup (`nvm install` / `nvm use` from `.nvmrc`, `corepack enable`).
- Docker is required for the database and for integration tests.
- Code, docs, UI text and test data are in English.
- Library versions: current stable at implementation time, pinned exactly in `package.json` (no `^`/`~`). Use the versions the plan verifies, not versions from memory.

## 4. Design

### 4.1 Repository and tooling

| Item | Decision |
|---|---|
| Node | `.nvmrc` = `24`; root `package.json` `engines.node` = `>=24 <25` |
| pnpm | `packageManager` field pins the exact pnpm version; installed via `corepack enable` |
| Workspaces | `apps/*`, `packages/*` |
| Internal packages | `contracts`, `db` and `config` are consumed as TypeScript source (no build step), via `exports` pointing at `src`. *(Claude's call — builder may choose a build step if a tool requires it.)* |
| TypeScript | Strict. Shared presets in `packages/config` (base, node, react) |
| Lint / format | Root `biome.json`. Biome runs once at the root, not per package |
| Env | Root `.env.example` committed; `.env` git-ignored. The API validates env with Zod at startup and fails fast with a readable message |

**Root scripts** (the same names are used in the README and the skill):

| Script | Does |
|---|---|
| `pnpm db:up` | Start PostgreSQL via Docker Compose and wait until it is healthy |
| `pnpm db:down` | Stop the database container (data kept) |
| `pnpm db:reset` | Drop the volume, start fresh and migrate (data is disposable, ADR-0004) |
| `pnpm db:migrate` | Apply Drizzle migrations |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm dev` | Run API and web in watch mode (Turborepo) |
| `pnpm lint` | `biome check` on the whole repo |
| `pnpm format` | Biome format + safe fixes, writing changes |
| `pnpm typecheck` | `tsc --noEmit` in every package (Turborepo) |
| `pnpm test` | All Vitest suites (unit + API integration; integration needs Docker) |
| `pnpm build` | Build all apps (sanity check only; no deployment) |

Script names are fixed by this spec. Their implementation is left to the builder.

### 4.2 Local runtime

| Component | How it runs | Address |
|---|---|---|
| PostgreSQL | Docker Compose service with a named volume and a healthcheck | host port from `.env` (`POSTGRES_PORT`, default `5442`) |
| API | On the host, `tsx` watch | `http://localhost:3330`, all routes under `/api` |
| Web | On the host, Vite dev server, `strictPort: true` | `http://localhost:5330` |

- Vite proxies `/api` to the API, so the browser sees one origin. That avoids CORS in dev and lets the session cookie work without cross-site settings.
- Ports are fixed so that the skill and README can rely on them. If a port is busy, startup fails loudly instead of silently moving to another port.

### 4.3 Data model (`packages/db`)

Table `users`:

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | PK, generated by the database |
| `email` | `text` | not null, **unique**; always stored normalized |
| `created_at` | `timestamptz` | not null, default `now()` |

- Drizzle schema plus a generated SQL migration committed in `packages/db`.
- `packages/db` exports the schema, a client factory (from a connection string) and a programmatic `migrate` function. Integration tests use the same function on the Testcontainers database.
- No seed data in this scope; the `seed` entry point arrives with lessons and tags.

### 4.4 API contract (`packages/contracts`)

All schemas are Zod. Response bodies are validated on output as well as input, so the contract cannot drift from the implementation.

**Email normalization (ADR-0024).** `EmailSchema` trims, lowercases and validates the email format. It is the single definition used by the web form, the API body validation and the DB write.

**Error shape (ADR-0022).** Every non-2xx response from the API has this body:

```ts
ApiError = {
  error: {
    code: string;          // machine-readable, e.g. "VALIDATION_ERROR", "UNAUTHENTICATED", "INTERNAL_ERROR"
    message: string;       // human-readable, safe to show in a toast
    details?: { path: string; message: string }[]; // field issues for validation errors
  }
}
```

Fastify's validation errors, 404s and unhandled errors are all mapped to this shape by one error handler. Internal errors never leak stack traces or SQL in `message`.

**Endpoints**

| Method & path | Request | Success | Errors |
|---|---|---|---|
| `POST /api/auth/login` | `{ email }` | `200 User`, sets session cookie. Creates the user if the normalized email does not exist, otherwise returns the existing one | `400 VALIDATION_ERROR` |
| `GET /api/auth/me` | — (cookie) | `200 User` | `401 UNAUTHENTICATED` when there is no cookie, the cookie is invalid, or the user no longer exists (e.g. after `db:reset`); in that last case the cookie is also cleared |
| `POST /api/auth/logout` | — | `204`, clears the cookie. Idempotent: works without a session too | — |
| `GET /api/health` | — | `200 { status: "ok" }` after a successful DB round-trip | `503` when the DB is unreachable |

`User = { id: string (uuid); email: string; createdAt: string (ISO 8601) }`

- Login is race-safe: two concurrent logins for a new email produce one user (insert on conflict on `email`, then return the row).
- OpenAPI 3 is generated from the registered Zod schemas. The JSON spec and an interactive UI are served by the API under `/api/docs`.

### 4.5 Session (ADR-0023)

- On login the API sets a **signed, httpOnly** cookie holding the user id. The cookie uses `SameSite=Lax` and `Path=/`, is `Secure` outside development, and has a 30-day max age *(Claude's call)*. It is signed with `COOKIE_SECRET` from env.
- There is no sessions table. Logout clears the cookie on the client.
- Identity is resolved in **one place**: a Fastify plugin that decorates `request.user` and offers a `requireUser` guard. Business routes never read the cookie themselves. This is the single auth boundary that ADR-0001 requires, so real authentication can later replace it without touching business endpoints.

### 4.6 Web app (`apps/web`)

**Infrastructure (the reusable pattern):**

- **HTTP client (ADR-0025).** A thin typed wrapper over `fetch`. It takes a request and the expected response Zod schema from `contracts`, sends JSON with `credentials: "include"`, and parses success bodies with the schema. On a non-2xx response it parses the body as `ApiError` and throws a typed `ApiClientError`. If the error body does not match `ApiError`, it throws a generic `ApiClientError` with code `UNKNOWN` and does not invent fields.
- **TanStack Query.** One `QueryClient`. The `MutationCache` has a global `onError` that shows a toast with `error.message` for every failed mutation (ADR-0021). Individual mutations may opt out through `meta`, but none do in this scope. Query errors do not toast globally.
- **Toasts.** Sonner via the shadcn/ui wrapper, mounted once at the app root (ADR-0021).
- **Forms.** TanStack Form with the Zod schema from `contracts` as the validator (ADR-0020). While the mutation is pending, all fields and the submit button are disabled and the button shows a spinner.
- **Routing.** TanStack Router (file-based or code-based, the builder chooses). An `_authenticated` layout route loads the current user via the `me` query in `beforeLoad`/loader and redirects to `/login` on `401`. `/login` redirects to `/` if the user is already logged in.
- **UI.** Tailwind CSS and shadcn/ui are initialised, with the components this scope needs (Button, Input, Label, Sonner, plus a form field wrapper).

**Screens:**

- `/login`: an email input and a "Log in" button. Client-side validation messages appear under the field. On success, the `me` query cache is set and the user is navigated to `/`. On an API error, a toast appears and the form unlocks.
- `/` (authenticated): a placeholder that says "Logged in as {email}", plus a "Log out" button. Logging out calls the logout mutation, clears the query cache and navigates to `/login`. The button shows a spinner while pending.
- A browser refresh on `/` keeps the user logged in, because `me` succeeds from the cookie.

### 4.7 Tests

- Vitest is configured in `apps/api` and `packages/contracts`. `pnpm test` runs all of it through Turborepo.
- **API integration tests** run against real PostgreSQL via Testcontainers (ADR-0018). One container is started per test run in global setup, migrations are applied with the `packages/db` migrate function, and tables are truncated between tests. Requests are made against the Fastify instance with `inject` (no network port).
- Required cases:
  - login with a new email creates exactly one user row and returns `200 User` with a session cookie;
  - login with an existing email in different case and with whitespace returns the same user, and no new row is created;
  - login with an invalid email returns `400` in `ApiError` shape with `details`;
  - `me` with the login cookie returns the user; `me` without a cookie returns `401 UNAUTHENTICATED`;
  - `me` with a tampered cookie returns `401`;
  - `me` with a valid cookie for a deleted user returns `401` and clears the cookie;
  - logout returns `204` and clears the cookie, after which `me` with the cleared cookie returns `401`; logout without a session also returns `204`;
  - `health` returns `200`.
- **Unit test** in `contracts`: `EmailSchema` normalization and rejection cases.

### 4.8 README and agent skill

- **`README.md`** (root): what the app is (one paragraph, linking to the PRD), prerequisites, first-time setup from a fresh clone (nvm → corepack → `pnpm install` → `.env` → `db:up` → `db:migrate` → `dev`), the URLs, the commands table from §4.1, how to run tests (Docker required), how to reset data, and troubleshooting for the failures actually hit during verification (e.g. busy port, Docker not running, wrong Node version).
- **Agent skill** at `.claude/skills/local-dev/SKILL.md` (ADR-0026). It covers:
  - **Start:** check prerequisites (Node version from `.nvmrc`, pnpm, Docker running). The skill does **not** change the host: if Node 24, pnpm or a running Docker daemon is missing, it stops and reports the exact command the human should run (from the README). It may run `pnpm install` when `node_modules` is missing or stale. Then `db:up`, `db:migrate`, and `pnpm dev` in the background with output to a known log file. Because an agent's shell does not keep state between commands, every command the skill runs must select Node 24 on its own (e.g. through a repo helper script that sources nvm and runs `nvm exec`), not rely on an earlier `nvm use`.
  - **Readiness:** poll `GET http://localhost:5330/api/health` (through the proxy, which proves web, API and DB together) with a timeout. Report "ready" with URLs or "failed" with the log tail. Never assume readiness.
  - **Idempotency:** if the app is already running and healthy, reuse it instead of starting a second copy.
  - **Stop / reset:** stop the dev processes, `db:down`, and `db:reset` for a clean slate.
  - **E2E usage:** how to drive the app with the Playwright plugin / MCP server (ADR-0027): base URL, the login → placeholder → refresh → logout flow to check, and fresh `@example.com` emails per run so checks don't collide. If the plugin is not available, the skill says so instead of improvising another browser tool.
- The skill uses **only** the root scripts from §4.1, the same ones the README uses. Any helper script it needs lives in the repo (e.g. `scripts/`) and the README can use it too.

**Verification (part of done):** on a clean state (no `node_modules`, `.env` and DB volume removed), the README steps are executed literally, in order, and each one is confirmed. The app is then started through the skill, and the login → placeholder → refresh → logout flow is driven in a real browser with the Playwright plugin. Every mismatch found is fixed in the README or skill, not worked around.

## 5. Decisions recorded with this scope

| ADR | Decision |
|---|---|
| [ADR-0020](../../adr/0020-tanstack-form-for-forms.md) | TanStack Form for forms, validated with contract Zod schemas |
| [ADR-0021](../../adr/0021-global-mutation-error-toasts-with-sonner.md) | Global mutation error toasts with Sonner |
| [ADR-0022](../../adr/0022-uniform-api-error-shape.md) | One error response shape for every API error |
| [ADR-0023](../../adr/0023-signed-cookie-session-without-session-store.md) | Signed cookie holding the user id, no session store (tech-debt) |
| [ADR-0024](../../adr/0024-normalize-emails-trim-lowercase.md) | Normalize emails by trimming and lowercasing |
| [ADR-0025](../../adr/0025-thin-typed-fetch-client.md) | Thin typed `fetch` client instead of an HTTP library or generated client |
| [ADR-0026](../../adr/0026-local-dev-postgres-in-docker-apps-on-host-with-agent-skill.md) | Local dev: only PostgreSQL in Docker, apps on host, one repo skill for agents |
| [ADR-0027](../../adr/0027-defer-committed-e2e-suite-use-playwright-plugin.md) | No committed e2e suite yet; agents use the Playwright plugin (tech-debt) |
| [ADR-0028](../../adr/0028-fastify-zod-type-provider-and-swagger-for-openapi.md) | fastify-type-provider-zod + @fastify/swagger (recorded during execution) |
| [ADR-0029](../../adr/0029-pnpm-supply-chain-policy-exceptions.md) | pnpm 12 supply-chain policy exceptions (tech-debt, recorded during execution) |

## 6. Left to the builder

- File-based vs code-based TanStack Router routes.
- Exact Fastify plugin for Zod integration and OpenAPI generation, as long as one Zod schema drives validation, types and OpenAPI.
- How readiness polling and background start are scripted for the skill, within §4.8.
- Internal package layout inside each app (folders, module names), following conventions that later features can repeat.
- Exact wording of UI text and error messages.

## 7. Done when

- All goals in §2 are met and no anti-goal is violated.
- `pnpm lint`, `pnpm typecheck` and `pnpm test` pass.
- The README verification and the skill + Playwright plugin verification in §4.8 have been carried out and pass.
- `TECH_STACK.md`, the ADR index and the specs index are updated.

## 8. Claude's calls

- 30-day cookie lifetime; `SameSite=Lax`.
- `200` (not `201`) on login in both the "created" and "existing" cases, because the client does not need to tell them apart.
- `/api` prefix on all API routes so that the Vite proxy needs no path rewrite.
- Internal packages consumed as TS source without a build step.
- Global toasts only for mutations; query errors are handled where the query is used (e.g. the router redirect on `401`).
- The skill never installs Node, enables corepack or starts Docker; it stops and tells the human what to run. The one-time README verification on the developer's machine does run `nvm install` (from `.nvmrc`) and `corepack enable`, because those are README steps. `nvm install` does not change the nvm default alias.
- Email normalization (ADR-0024) is a correctness rule and does not conflict with ADR-0004, which only rejected normalization as migration preparation.

## Changelog

- 2026-10-25: Default PostgreSQL host port changed from `5432` to `5442`. During execution, `5432` and `5433` were already taken by other local projects' Postgres containers, which is common on developer machines. A non-standard default lets the README work without a port-conflict detour.
- 2026-10-25: Dev ports changed from API `3000` / web `5173` to API `3330` / web `5330`. The common defaults were taken by another local project's dev server during execution; the non-standard fixed ports avoid that clash. ADR-0026 was updated in place because it had been accepted in this same, not-yet-committed change.

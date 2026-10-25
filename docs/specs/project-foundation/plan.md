# Project Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.
- **Status:** done

**Goal:** A pnpm/Turborepo monorepo that runs locally end to end (PostgreSQL in Docker, Fastify API, React SPA), with email login, a type-safe Zod contract, tests, a verified README and a `local-dev` agent skill.

**Architecture:** `packages/contracts` holds the Zod schemas that drive API validation, OpenAPI and the web client. `packages/db` holds the Drizzle schema, migrations and a migrate function that the CLI and the tests share. `apps/api` is a Fastify app built by `buildApp()` so tests can `inject` without a port. `apps/web` is a Vite SPA that proxies `/api` to the API.

**Tech Stack:** Node 24, pnpm 12, Turborepo, TypeScript 7, Biome 2, Zod 4, Fastify 5 + fastify-type-provider-zod, Drizzle + node-postgres, PostgreSQL 18, Vitest 5 + Testcontainers, React 19 + Vite 8, TanStack Router/Query/Form, Tailwind 4 + shadcn/ui + Sonner.

**Spec:** [spec.md](spec.md)

## Global Constraints

- Every rule in [spec.md](spec.md) §2–§4 applies; the spec wins over this plan if they disagree. Raise the conflict instead of picking one silently.
- **Git:** do not commit, branch, stash or otherwise write to git. Each task ends with a checkpoint that lists the changed files. Commit only when the user explicitly asks (user CLAUDE.md).
- Node is selected from `.nvmrc` (`24`); `engines.node` is `>=24 <25`. pnpm is pinned through `packageManager` and installed by corepack.
- All dependency versions are pinned exactly (no `^`/`~`), using the table below. If a pinned version fails to install or work, stop and report; do not silently pick another version.
- Package names: `@drum-tutor/contracts`, `@drum-tutor/db`, `@drum-tutor/config`, `@drum-tutor/api`, `@drum-tutor/web`. Internal packages export TypeScript source (`"exports": { ".": "./src/index.ts" }`) with no build step.
- Ports: API `3330`, web `5330` (`strictPort: true`), Postgres host port from `POSTGRES_PORT` (default `5442`, see spec Changelog). All API routes live under `/api`.
- Code, docs, UI copy and test data are in English. Test emails use `@example.com`.
- Biome is the only linter and formatter. Run `pnpm format` before closing each task.
- Any shortcut or `TODO` needs a tech-debt ADR, and the comment must read `// TODO(ADR-NNNN): …`.

**Pinned versions** (checked against the npm registry on 2026-10-25):

| Package                         | Version                | Package                      | Version         |
| ------------------------------- | ---------------------- | ---------------------------- | --------------- |
| pnpm                            | 12.15.0                | turbo                        | 2.11.10         |
| typescript                      | 7.0.2 ¹                | @biomejs/biome               | 2.6.3           |
| @types/node                     | 24.19.2                | tsx                          | 4.23.15         |
| vitest                          | 5.0.5                  | zod                          | 4.6.7           |
| fastify                         | 5.12.7                 | fastify-plugin               | 6.0.1           |
| @fastify/cookie                 | 11.1.3                 | @fastify/swagger             | 9.9.2           |
| @fastify/swagger-ui             | 6.1.2                  | fastify-type-provider-zod    | 7.0.0           |
| openapi-types                   | 12.1.3                 | drizzle-orm                  | 0.45.4          |
| drizzle-kit                     | 0.31.11                | pg / @types/pg               | 8.23.1 / 8.23.1 |
| @testcontainers/postgresql      | 12.2.1                 | react / react-dom            | 19.3.1 / 19.3.1 |
| @types/react / @types/react-dom | 19.3.0 / 19.3.0        | vite                         | 8.3.5           |
| @vitejs/plugin-react            | 6.1.2                  | @tanstack/react-router       | 1.170.46        |
| @tanstack/router-plugin         | 1.168.48               | @tanstack/react-query        | 5.104.5         |
| @tanstack/react-form            | 1.33.5                 | sonner                       | 2.0.8           |
| tailwindcss / @tailwindcss/vite | 4.3.3 / 4.3.3          | shadcn (CLI, via `pnpm dlx`) | 4.22.1          |
| Docker image                    | `postgres:18.6-alpine` |                              |                 |

¹ TypeScript 7 is the native compiler. If a tool in this stack fails against it, fall back to `6.0.3` everywhere and report it. Do not mix versions.

Shadcn component dependencies (`radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css`, `next-themes`) are whatever `shadcn@4.22.1 add` installs. After install, pin them exactly in `apps/web/package.json`.

## Review Focus

1. **Malformed login requests.** A body that is not JSON, has the wrong content type, or has no `email` must return `400` in the `ApiError` shape, never `500` or a Fastify default body. Tested in Task 4.
2. **Bad session cookies.** A cookie with a valid signature but a non-UUID value (or any garbage) must return `401`, never `500` from a Postgres `uuid` cast. Tested in Task 5.
3. **Concurrent first login.** Two simultaneous logins with the same new email must create exactly one user, and both must get `200` with the same id. Tested in Task 5.
4. **API unreachable from the browser.** If the API is down, a login submit must unlock the form and toast "Cannot reach the server". A route load that cannot reach `me` must show an error with a Retry button instead of redirect-looping. Implemented in Task 6, checked in the browser in Task 7.
5. **Busy port or stale dev process.** `dev-start` must reuse a healthy running instance, and must fail with a message naming the port when the port is taken by something else. Tested in Task 8.

---

### Task 1: Monorepo skeleton and tooling

**Files:**
- Create: `.nvmrc`, `.gitignore`, `.env.example`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `biome.json`
- Create: `packages/config/package.json`, `packages/config/tsconfig.base.json`, `packages/config/tsconfig.node.json`, `packages/config/tsconfig.react.json`
- Create: `scripts/with-node.sh`

**Interfaces:**
- Produces: the root scripts from spec §4.1. In this task `lint`, `format`, `typecheck`, `test`, `build` and `dev` delegate to Turbo or Biome; the `db:*` scripts are added in Task 3. Also produces the tsconfig presets `@drum-tutor/config/tsconfig.node.json` and `@drum-tutor/config/tsconfig.react.json`, and `scripts/with-node.sh <cmd...>`.

- [x] **Step 1: Write the root files**
  - `.nvmrc`: `24`.
  - `package.json`: `private: true`, `packageManager: "pnpm@12.15.0"`, `engines.node: ">=24 <25"`, devDependencies `turbo`, `@biomejs/biome`, `typescript`.
  - Root scripts: `dev` = `turbo run dev`, `build` = `turbo run build`, `typecheck` = `turbo run typecheck`, `test` = `turbo run test`, `lint` = `biome check .`, `format` = `biome check --write .`.
  - `pnpm-workspace.yaml`: `apps/*`, `packages/*`.
  - `turbo.json`: `dev` is `persistent` with `cache: false`; `build` has `dependsOn: ["^build"]` and outputs `dist/**`; `typecheck` runs with no outputs; `test` has `cache: false`.
  - `.gitignore`: `node_modules`, `dist`, `.turbo`, `.env`, `.dev/`, `*.tsbuildinfo`, `.DS_Store`.
  - `biome.json`: recommended rules, 2-space indent, line width 100. Ignore `**/routeTree.gen.ts`, `**/migrations/meta/**`, `dist`, `.turbo`, `.dev`.
- [x] **Step 2: Write the tsconfig presets**
  - `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`, `skipLibCheck`, `noEmit`, `module: "preserve"`, `moduleResolution: "bundler"`, `target: "ES2024"`, `resolveJsonModule`.
  - `tsconfig.node.json` extends base and adds `types: ["node"]`.
  - `tsconfig.react.json` extends base and adds `jsx: "react-jsx"` and `lib: ["ES2024", "DOM", "DOM.Iterable"]`.
  - Do not use `baseUrl`; it was removed in TypeScript 7.
- [x] **Step 3: Write `scripts/with-node.sh`**
  The script sources `$NVM_DIR/nvm.sh` (default `~/.nvm`). It then runs `"$@"` under the version in `.nvmrc` using `nvm exec --silent`, resolved from the repo root no matter what the cwd is. Make it executable.
  It does not install anything. If the `.nvmrc` version is missing, it exits non-zero with: `Node <v> is not installed. Run: nvm install`.
- [x] **Step 4: Write `.env.example`**
  Variables: `POSTGRES_USER=drum`, `POSTGRES_PASSWORD=drum`, `POSTGRES_DB=drum_tutor`, `POSTGRES_PORT=5442`, `DATABASE_URL=postgres://drum:drum@localhost:5442/drum_tutor`, `API_PORT=3330`, `COOKIE_SECRET=` (a placeholder at least 32 chars, with a comment saying to change it), `NODE_ENV=development`.
- [x] **Step 5: Install and verify**
  Run: `nvm install && corepack enable && corepack install && pnpm install`, then `pnpm lint && pnpm typecheck`.
  Expected: the install succeeds. pnpm may block dependency build scripts; allow exactly the ones a later step needs (e.g. `esbuild`) in `pnpm-workspace.yaml`, and list them in the checkpoint. `pnpm lint` reports no errors.
- [x] **Step 6: Checkpoint.** `pnpm format`. List the changed files. Do not commit.

### Task 2: Contracts package

**Files:**
- Create: `packages/contracts/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/contracts/src/index.ts`, `src/auth.ts`, `src/api-error.ts`, `src/health.ts`, `src/paths.ts`
- Test: `packages/contracts/src/auth.test.ts`

**Interfaces:**
- Produces (all exported from `@drum-tutor/contracts`):
  - `EmailSchema`: Zod string. Trims, lowercases, validates the email format, max 254 chars. Output is the normalized email.
  - `LoginRequestSchema = z.object({ email: EmailSchema })`; `type LoginRequest`.
  - `UserSchema = z.object({ id: z.uuid(), email: z.string(), createdAt: z.iso.datetime() })`; `type User`.
  - `ApiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.array(z.object({ path: z.string(), message: z.string() })).optional() }) })`; `type ApiError`.
  - `ApiErrorCode = { VALIDATION_ERROR, BAD_REQUEST, UNAUTHENTICATED, NOT_FOUND, SERVICE_UNAVAILABLE, INTERNAL_ERROR } as const`, with values equal to the keys.
  - `HealthResponseSchema = z.object({ status: z.literal("ok") })`.
  - `ApiPaths = { health: "/api/health", login: "/api/auth/login", me: "/api/auth/me", logout: "/api/auth/logout", docs: "/api/docs" } as const`.
- Scripts: `test` = `vitest run`, `typecheck` = `tsc --noEmit`.

- [x] **Step 1: Write the failing tests in `auth.test.ts`**

```ts
describe("EmailSchema", () => {
  it("trims and lowercases", () => {
    expect(EmailSchema.parse("  Jan.Kowalski@Example.COM ")).toBe("jan.kowalski@example.com");
  });
  it.each(["", "   ", "not-an-email", "a@", "@example.com", `${"a".repeat(250)}@example.com`])(
    "rejects %j",
    (value) => expect(EmailSchema.safeParse(value).success).toBe(false),
  );
});
describe("LoginRequestSchema", () => {
  it("rejects a missing email", () => expect(LoginRequestSchema.safeParse({}).success).toBe(false));
});
describe("ApiErrorSchema", () => {
  it("accepts an error without details", () => {
    expect(
      ApiErrorSchema.safeParse({ error: { code: "NOT_FOUND", message: "Not found" } }).success,
    ).toBe(true);
  });
});
```

- [x] **Step 2: Run** `pnpm --filter @drum-tutor/contracts test`. Expected: FAIL, because the modules are missing.
- [x] **Step 3: Implement the schemas listed under Interfaces.** Normalization must run before format validation, so `" Jan@X.com "` is valid. For example: `z.string().trim().toLowerCase().pipe(z.email().max(254))`. Check that it still produces a usable OpenAPI schema in Task 4.
- [x] **Step 4: Run** `pnpm --filter @drum-tutor/contracts test` and `pnpm typecheck`. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. List the changed files. Do not commit.

### Task 3: Database package and Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `packages/db/package.json`, `tsconfig.json`, `drizzle.config.ts`
- Create: `packages/db/src/index.ts`, `src/schema.ts`, `src/client.ts`, `src/migrate.ts`, `src/migrate-cli.ts`, `src/load-env.ts`
- Create (generated): `packages/db/migrations/*`
- Modify: root `package.json` (the `db:*` scripts)

**Interfaces:**
- Produces (from `@drum-tutor/db`):
  - `users` table (Drizzle). `id: uuid().primaryKey().defaultRandom()`, `email: text().notNull().unique()`, `createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()`.
  - `type UserRow = typeof users.$inferSelect`.
  - `createDb(connectionString: string): { db: Database; close: () => Promise<void> }`, where `type Database = NodePgDatabase<typeof schema>` (node-postgres `Pool`).
  - `runMigrations(connectionString: string): Promise<void>`. It uses `drizzle-orm/node-postgres/migrator` with the migrations folder resolved from `import.meta.dirname`, so it works from any cwd.
  - `loadRootEnv(): void`. It calls `process.loadEnvFile(<repo>/.env)` only when the file exists, and is used by `drizzle.config.ts`, `migrate-cli.ts` and the API entry.
- Root scripts:
  - `db:up` = `docker compose up -d --wait`
  - `db:down` = `docker compose down`
  - `db:reset` = `docker compose down -v && docker compose up -d --wait && pnpm db:migrate`
  - `db:migrate` = `pnpm --filter @drum-tutor/db migrate` (runs `tsx src/migrate-cli.ts`)
  - `db:generate` = `pnpm --filter @drum-tutor/db generate` (runs `drizzle-kit generate`)

- [x] **Step 1: Write `docker-compose.yml`.** One service, `postgres`, using `postgres:18.6-alpine`, with env from `.env` (`POSTGRES_USER/PASSWORD/DB`) and port `${POSTGRES_PORT:-5442}:5432`. The named volume `pgdata` is mounted at `/var/lib/postgresql`, which is the PG 18 layout (not `/var/lib/postgresql/data`). Add a healthcheck: `pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB`, interval 2s, retries 15.
- [x] **Step 2: Write `schema.ts`, `client.ts`, `migrate.ts`, `migrate-cli.ts`, `load-env.ts` and `drizzle.config.ts`** as described under Interfaces. `migrate-cli` reads `DATABASE_URL` and exits non-zero with a readable message when it is missing.
- [x] **Step 3: Generate the migration.** Run `cp .env.example .env` if `.env` does not exist, then `pnpm db:generate`. Expected: one SQL migration that creates `users` with a unique constraint on `email` and `DEFAULT gen_random_uuid()`.
- [x] **Step 4: Verify against Docker.**
  Run: `pnpm db:up && pnpm db:migrate && docker compose exec postgres psql -U drum -d drum_tutor -c '\d users'`. Expected: the table exists with the 3 columns and the unique index.
  Run: `pnpm db:migrate` again. Expected: no-op success.
  Run: `pnpm db:reset`. Expected: success, and `users` is empty.
- [x] **Step 5: Checkpoint.** `pnpm format && pnpm typecheck`. List the changed files. Do not commit.

### Task 4: API foundation — app factory, errors, health, OpenAPI, test harness

**Files:**
- Create: `apps/api/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `apps/api/src/env.ts`, `src/app.ts`, `src/server.ts`
- Create: `apps/api/src/plugins/error-handler.ts`, `src/plugins/openapi.ts`
- Create: `apps/api/src/modules/health/health.routes.ts`
- Create: `apps/api/test/global-setup.ts`, `test/helpers.ts`
- Test: `apps/api/src/env.test.ts`, `src/modules/health/health.test.ts`, `src/plugins/error-handler.test.ts`

**Interfaces:**
- Consumes: `@drum-tutor/contracts` (`ApiErrorSchema`, `ApiErrorCode`, `HealthResponseSchema`, `ApiPaths`) and `@drum-tutor/db` (`createDb`, `runMigrations`, `loadRootEnv`, `Database`, `users`).
- Produces:
  - `loadEnv(source = process.env): Env`. Zod-validated: `DATABASE_URL` (url), `COOKIE_SECRET` (min 32), `API_PORT` (coerced int, default 3330), `NODE_ENV` (`development | test | production`, default `development`). On failure it throws an `Error` whose message lists every invalid variable by name.
  - `buildApp(options: { db: Database; cookieSecret: string; isProduction: boolean; logger?: boolean }): Promise<FastifyInstance>`. Registers the Zod validator and serializer compilers, `@fastify/cookie` (with the secret), the error handler, OpenAPI, and the route modules. It does not listen.
  - `server.ts`: `loadRootEnv()` → `loadEnv()` → `createDb()` → `buildApp()` → `listen({ port: API_PORT, host: "127.0.0.1" })`. Closes the DB on SIGINT/SIGTERM.
  - Test helpers in `test/helpers.ts`:
    - `createTestApp(): Promise<{ app: FastifyInstance; db: Database; close(): Promise<void> }>` uses the URL from `inject("databaseUrl")`;
    - `resetDatabase(db: Database): Promise<void>` runs `TRUNCATE users CASCADE`.
  - `global-setup.ts` starts `PostgreSqlContainer("postgres:18.6-alpine")`, runs `runMigrations(uri)`, calls `provide("databaseUrl", uri)`, and stops the container in teardown.
- Scripts: `dev` = `tsx watch src/server.ts`, `test` = `vitest run`, `typecheck` = `tsc --noEmit`, `build` = `tsc --noEmit`. The build is only a sanity check; per spec §2 there is no deployable build.
- `vitest.config.ts`: `globalSetup: ["./test/global-setup.ts"]`, `fileParallelism: false` (one shared database), `testTimeout: 30_000`.

- [x] **Step 1: Write the failing tests**

```ts
// env.test.ts
it("lists every invalid variable", () => {
  expect(() => loadEnv({ DATABASE_URL: "nope" })).toThrow(/DATABASE_URL[\s\S]*COOKIE_SECRET/);
});
it("defaults API_PORT to 3330", () => {
  expect(loadEnv({ DATABASE_URL: "postgres://u:p@localhost:5432/db", COOKIE_SECRET: "x".repeat(32) }).API_PORT).toBe(3330);
});

// health.test.ts
it("GET /api/health returns ok", async () => {
  const res = await app.inject({ method: "GET", url: ApiPaths.health });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ status: "ok" });
});
it("returns 503 SERVICE_UNAVAILABLE when the database is unreachable", async () => {
  // buildApp with createDb("postgres://u:p@127.0.0.1:1/none")
  expect(res.statusCode).toBe(503);
  expect(ApiErrorSchema.parse(res.json()).error.code).toBe("SERVICE_UNAVAILABLE");
});
it("serves the OpenAPI document with the registered paths", async () => {
  const res = await app.inject({ method: "GET", url: `${ApiPaths.docs}/json` });
  expect(res.statusCode).toBe(200);
  expect(Object.keys(res.json().paths)).toContain(ApiPaths.health);
});

// error-handler.test.ts
it("unknown route → 404 NOT_FOUND in ApiError shape", …);              // GET /api/nope
it("malformed JSON body → 400 BAD_REQUEST in ApiError shape", …);       // POST health-like test route with body "{"
it("unhandled error → 500 INTERNAL_ERROR with a generic message", …);   // test-only route that throws Error("secret detail"); expect message not to contain "secret detail"
it("schema validation failure → 400 VALIDATION_ERROR with details[].path", …);
```

In `error-handler.test.ts`, register the test-only routes on the instance returned by `buildApp` before calling `ready()`, through a small plugin. Do not add them to production code.

- [x] **Step 2: Run** `pnpm --filter @drum-tutor/api test`. Expected: FAIL, because the modules are missing. This also proves Testcontainers starts. If Docker is not running, the failure must say so.
- [x] **Step 3: Implement `env.ts`, `app.ts`, `server.ts`, the error handler, OpenAPI and the health route.**
  - **Error handler:**
    - `hasZodFastifySchemaValidationErrors` → 400 `VALIDATION_ERROR`, message `"Invalid request"`, with `details` mapped from `instancePath`/`message`.
    - Any other error with `statusCode` 400–499 → that status with `BAD_REQUEST`, message `"Invalid request"`.
    - Everything else, including `isResponseSerializationError` → log the error, then 500 `INTERNAL_ERROR` with `"Internal server error"`.
    - `setNotFoundHandler` → 404 `NOT_FOUND`.
  - **OpenAPI:** `@fastify/swagger` (`openapi: "3.1.0"`, `transform: jsonSchemaTransform`) plus `@fastify/swagger-ui` at `routePrefix: ApiPaths.docs`.
  - **Health route:** runs `select 1`. On a DB error it returns 503 with `ApiError` `SERVICE_UNAVAILABLE`, `"Database unavailable"`. Every route declares its response schemas, including error statuses (`ApiErrorSchema`).
- [x] **Step 4: Run** `pnpm --filter @drum-tutor/api test`. Expected: PASS.
- [x] **Step 5: Smoke test.** With the DB up, run `pnpm --filter @drum-tutor/api dev`, then `curl -s localhost:3330/api/health` → `{"status":"ok"}`, and open `localhost:3330/api/docs`, which renders Swagger UI. Stop the server.
- [x] **Step 6: Checkpoint.** `pnpm format && pnpm lint && pnpm typecheck`. List the changed files. Do not commit.

### Task 5: API auth — session plugin and login/me/logout

**Files:**
- Create: `apps/api/src/plugins/auth.ts`
- Create: `apps/api/src/modules/auth/users.repository.ts`, `src/modules/auth/auth.routes.ts`
- Modify: `apps/api/src/app.ts` (register the auth plugin and the routes)
- Test: `apps/api/src/modules/auth/auth.test.ts`

**Interfaces:**
- Consumes: `buildApp` and the test helpers (Task 4), `LoginRequestSchema`, `UserSchema`, `ApiPaths`, `ApiErrorCode` (Task 2), and `users` (Task 3).
- Produces:
  - `SESSION_COOKIE = "dt_session"`.
  - Auth plugin (wrapped with `fastify-plugin`):
    - decorates `request.user: User | null`, resolved in an `onRequest` hook from the signed cookie;
    - exports `requireUser` (preHandler → 401 `UNAUTHENTICATED`, `"Not logged in"`);
    - provides `reply.setSession(userId: string)` and `reply.clearSession()`.
    - Cookie options: `signed`, `httpOnly`, `sameSite: "lax"`, `secure: isProduction`, `path: "/"`, `maxAge: 60 * 60 * 24 * 30`.
  - The hook treats the request as anonymous when the signature is invalid or the value is not a UUID; it does not query the DB in those cases. If the cookie is valid but the user is missing, it treats the request as anonymous and clears the cookie.
  - `findOrCreateUserByEmail(db, email: string): Promise<UserRow>`: `insert … on conflict (email) do nothing`, then `select` by email. This is race-safe.
  - `findUserById(db, id: string): Promise<UserRow | null>`.
  - `toUserDto(row: UserRow): User` (`createdAt.toISOString()`).
  - Routes:
    - `POST /api/auth/login` (body `LoginRequestSchema`, 200 `UserSchema`, 400 `ApiErrorSchema`);
    - `GET /api/auth/me` (`requireUser`, 200 `UserSchema`, 401 `ApiErrorSchema`);
    - `POST /api/auth/logout` (204, empty body).

- [x] **Step 1: Write the failing tests** in `auth.test.ts`. Run `resetDatabase` before each test. Helper: `login(email) → res` and `cookieFrom(res)`, which reads `dt_session` from `res.cookies`.

```ts
it("login with a new email creates exactly one user and sets a session cookie", …);
// 200, UserSchema.parse(body), body.email === "new@example.com", one row in users, dt_session cookie is httpOnly, SameSite=Lax, Max-Age=2592000
it("login with the same email in another case and with spaces returns the same user", …);
// login("anna@example.com"), then login("  ANNA@Example.com "), same id, still one row
it("two concurrent first logins create one user", …);
// await Promise.all([login("race@example.com"), login("race@example.com")]), both 200, same id, one row
it("invalid email → 400 VALIDATION_ERROR with details", …);
// details[0].path contains "email"
it("missing body → 400 in ApiError shape", …);
it("me with the login cookie returns the user", …);
it("me without a cookie → 401 UNAUTHENTICATED", …);
it("me with a tampered cookie → 401", …);
// replace the last char of the signed value
it("me with a correctly signed non-UUID value → 401, not 500", …);
// sign "not-a-uuid" with app.signCookie
it("me for a deleted user → 401 and clears the cookie", …);
// delete the row, response sets dt_session with Max-Age=0 or a past Expires
it("logout → 204 and clears the cookie; me afterwards → 401", …);
it("logout without a session → 204", …);
it("OpenAPI document lists the auth paths", …);
// login, me, logout in paths
```

- [x] **Step 2: Run** `pnpm --filter @drum-tutor/api test -- auth`. Expected: FAIL.
- [x] **Step 3: Implement the plugin, repository and routes** as described under Interfaces. Business routes read only `request.user`; nothing outside `plugins/auth.ts` touches the cookie.
- [x] **Step 4: Run** `pnpm --filter @drum-tutor/api test`. Expected: all tests PASS.
- [x] **Step 5: Smoke test with curl** against `pnpm --filter @drum-tutor/api dev`, using a cookie jar: login → me (200) → logout → me (401).
- [x] **Step 6: Checkpoint.** `pnpm format && pnpm lint && pnpm typecheck`. List the changed files. Do not commit.

### Task 6: Web infrastructure — Vite, Tailwind/shadcn, router, query client, API client, toasts

**Files:**
- Create: `apps/web/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `components.json`
- Create: `apps/web/src/main.tsx`, `src/index.css`, `src/router.tsx`
- Create: `apps/web/src/lib/api-client.ts`, `src/lib/query-client.ts`, `src/lib/utils.ts`
- Create: `apps/web/src/components/ui/*` (via shadcn: `button`, `input`, `label`, `sonner`)
- Create: `apps/web/src/components/text-field.tsx`, `src/components/route-error.tsx`
- Create: `apps/web/src/routes/__root.tsx`, `src/routes/index.tsx` (a temporary page showing "Drum Tutor"; Task 7 replaces it)
- Generated: `apps/web/src/routeTree.gen.ts` (committed, ignored by Biome)

**Interfaces:**
- Consumes: `ApiErrorSchema`, `ApiPaths` (Task 2).
- Produces:
  - `class ApiClientError extends Error { status: number; code: string; details?: { path: string; message: string }[] }`.
  - `apiRequest<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown; schema: z.ZodType<T> | null }): Promise<T>`. `schema: null` means an empty `204` is expected.
    - Sends JSON with `credentials: "include"`.
    - A `2xx` body is parsed with `schema`. If parsing fails, it throws `ApiClientError(status, "INVALID_RESPONSE", "Unexpected response from the server")`.
    - A non-2xx body is parsed with `ApiErrorSchema`. If that fails, it throws `code: "UNKNOWN"`, `"Something went wrong"`.
    - If `fetch` rejects, it throws `status: 0`, `code: "NETWORK_ERROR"`, `"Cannot reach the server"`.
  - `createQueryClient(): QueryClient`. `MutationCache.onError` calls `toast.error(message)` unless `mutation.meta?.suppressErrorToast`. `message` is `error.message` for `ApiClientError`, otherwise `"Something went wrong"`. It also declares the `Register` augmentation for `mutationMeta: { suppressErrorToast?: boolean }`. Queries use `retry: false` for `ApiClientError` with status 4xx.
  - Router context: `{ queryClient: QueryClient }` (`createRootRouteWithContext`). The root route renders `<Outlet />` and `<Toaster />`, and sets `errorComponent: RouteError`.
  - `RouteError`: shows the error message and a "Retry" button that calls `router.invalidate()`.
  - `TextField`: a TanStack Form field bound to shadcn `Label` + `Input`. It shows the first field error under the input and takes `disabled`.
- Config:
  - `vite.config.ts`: plugins `tanstackRouter({ target: "react", autoCodeSplitting: true })` (before `react()`) and `tailwindcss()`; alias `@` → `src`; `server: { port: 5330, strictPort: true, proxy: { "/api": "http://localhost:3330" } }`.
  - `tsconfig.json`: extends the react preset with `paths: { "@/*": ["./src/*"] }`.
- Scripts: `dev` = `vite`, `build` = `vite build`, `typecheck` = `tsc --noEmit`.

- [x] **Step 1: Scaffold Vite + React + Tailwind 4** with the files above and the pinned versions. Run `pnpm dlx shadcn@4.22.1 init` non-interactively (or write `components.json` by hand), then `pnpm dlx shadcn@4.22.1 add button input label sonner`. Afterwards, pin the dependencies shadcn added.
- [x] **Step 2: Implement `api-client.ts`, `query-client.ts`, the router, `__root.tsx`, `RouteError`, `TextField` and the temporary `index.tsx`** as described under Interfaces.
- [x] **Step 3: Verify the build.** Run `pnpm typecheck && pnpm --filter @drum-tutor/web build`. Expected: PASS, and `routeTree.gen.ts` is generated.
- [x] **Step 4: Verify the proxy.** With the DB up, run `pnpm dev`, then `curl -s localhost:5330/api/health` → `{"status":"ok"}`, and `curl -s localhost:5330/` → HTML that contains the root div. Stop `pnpm dev`.
- [x] **Step 5: Checkpoint.** `pnpm format && pnpm lint`. List the changed files. Do not commit.

### Task 7: Web auth screens — login, placeholder, logout, session on refresh

**Files:**
- Create: `apps/web/src/features/auth/auth.api.ts`, `src/features/auth/login-form.tsx`
- Create: `apps/web/src/routes/login.tsx`, `src/routes/_authenticated.tsx`, `src/routes/_authenticated/index.tsx`
- Delete: `apps/web/src/routes/index.tsx` (the temporary page from Task 6)

**Interfaces:**
- Consumes:
  - `apiRequest`, `ApiClientError` and `TextField` (Task 6);
  - `LoginRequestSchema`, `EmailSchema`, `UserSchema`, `ApiPaths` and `User` (Task 2).
- Produces:
  - `meQueryKey = ["auth", "me"] as const`.
  - `meQueryOptions`: `queryOptions` whose `queryFn` returns `User | null`. A `401` (`ApiClientError` with status 401) returns `null`. Every other error is rethrown, so the route shows `RouteError`. `staleTime: Infinity`.
  - `useLoginMutation()`: on success it calls `setQueryData(meQueryKey, user)` and navigates to `/`.
  - `useLogoutMutation()`: on success it calls `queryClient.clear()` and navigates to `/login`.
  - `_authenticated.beforeLoad`: `ensureQueryData(meQueryOptions)`. If the result is `null`, it throws `redirect({ to: "/login" })`. Otherwise it returns `{ user }` into the route context.
  - `login.beforeLoad`: if `ensureQueryData` returns a user, it redirects to `/`.

UI copy (exact):

| Element            | Copy                   |
| ------------------ | ---------------------- |
| Login page heading | "Drum Tutor"           |
| Email label        | "Email"                |
| Login button       | "Log in"               |
| Placeholder text   | "Logged in as {email}" |
| Logout button      | "Log out"              |
- [x] **Step 1: Implement `auth.api.ts`, `LoginForm` and the three routes.**
  - `LoginForm` uses `useForm` with `validators: { onSubmit: LoginRequestSchema }` and a field-level `onBlur: EmailSchema`.
  - While `mutation.isPending`, the field and the button are disabled, and the button shows a spinning `Loader2` icon next to its text.
- [x] **Step 2: Verify typecheck and build.** Run `pnpm typecheck && pnpm --filter @drum-tutor/web build`. Expected: PASS.
- [x] **Step 3: Check the flow in a browser with the Playwright plugin** against `pnpm dev` (with the DB up and migrated). Expected:
  1. `/` redirects to `/login`.
  2. Submitting `not-an-email` shows the field error and sends no request.
  3. Submitting `foundation-check@example.com` shows "Logged in as foundation-check@example.com" on `/`.
  4. A reload keeps you on `/`, still logged in.
  5. While on `/`, opening `/login` redirects to `/`.
  6. "Log out" lands on `/login`, and a reload stays there.
  7. With the API stopped (only `vite` running), a login submit shows the toast "Cannot reach the server" and the form unlocks.
  8. With the API stopped, opening `/` shows `RouteError`. After restarting the API, "Retry" recovers.

  Take a screenshot of steps 3 and 7.
- [x] **Step 4: Checkpoint.** `pnpm format && pnpm lint`. List the changed files. Do not commit.

### Task 8: Dev lifecycle scripts and the `local-dev` skill

**Files:**
- Create: `scripts/dev-start.sh`, `scripts/dev-stop.sh`
- Create: `.claude/skills/local-dev/SKILL.md`
- Modify: root `package.json` (add `dev:start` = `./scripts/dev-start.sh` and `dev:stop` = `./scripts/dev-stop.sh` for humans who prefer them)

**Interfaces:**
- Consumes: `scripts/with-node.sh` (Task 1), the `db:*` scripts (Task 3), `pnpm dev`, and `GET /api/health` through the web proxy.
- Produces:
  - **`scripts/dev-start.sh`.** Exits `0` only when `http://localhost:5330/api/health` returns `{"status":"ok"}`. Steps, in order:
    1. If that health URL is already ok, print `already running` with the URLs and exit `0`.
    2. Check the prerequisites:
       - the `.nvmrc` Node is available through `with-node.sh`;
       - `pnpm` resolves;
       - `docker info` succeeds.

       On failure, print the exact human command (`nvm install`, `corepack enable`, "start Docker Desktop") and exit `1`. Never install these.
    3. If `node_modules` is missing or older than `pnpm-lock.yaml`, run `pnpm install --frozen-lockfile`.
    4. If `.env` is missing, copy it from `.env.example` and say so.
    5. Run `pnpm db:up && pnpm db:migrate`.
    6. If port `3330` or `5330` is in use, print `port <n> is in use by <process>` and exit `1`.
    7. Start `pnpm dev` in the background in its own process group, with output in `.dev/dev.log` and the PGID in `.dev/dev.pid`.
    8. Poll the health URL every 1s for up to 90s. On success, print `ready` with the web, API and docs URLs. On timeout, print the last 50 lines of the log and exit `1`.
  - **`scripts/dev-stop.sh`.** Kills the process group from `.dev/dev.pid` (if alive), removes the pid file, and confirms that ports 3330 and 5330 are free. It does not stop the DB; the skill calls `pnpm db:down` explicitly.
  - **`SKILL.md`.** Frontmatter `name: local-dev`, plus a description that triggers on "run/start/stop the app, check it in a browser, e2e check, reset data". Sections:
    - Start;
    - Readiness;
    - Reuse;
    - Stop;
    - Reset data (`dev-stop`, `pnpm db:reset`);
    - Driving the UI with the Playwright plugin: base URL `http://localhost:5330`, the flow from Task 7 Step 3 (items 1–6), unique `<scope>-<timestamp>@example.com` emails, and stating explicitly when the plugin is unavailable instead of using another browser tool;
    - Troubleshooting: what each failure message of `dev-start.sh` means.

    Every command in it runs through `scripts/*.sh` or `scripts/with-node.sh pnpm …`, matching the README.

- [x] **Step 1: Write `dev-start.sh`, `dev-stop.sh` and `SKILL.md`** as described above.
- [x] **Step 2: Verify cold start.** With nothing running, `./scripts/dev-start.sh` prints `ready` and exits 0.
- [x] **Step 3: Verify reuse.** Run `./scripts/dev-start.sh` again. It prints `already running`, exits 0, and `.dev/dev.pid` is unchanged.
- [x] **Step 4: Verify stop.** `./scripts/dev-stop.sh` leaves `lsof -i :3330 -i :5330` empty.
- [x] **Step 5: Verify a busy port.** Hold port 3330 with `python3 -m http.server 3330`. `./scripts/dev-start.sh` must exit 1 with `port 3330 is in use`. Then kill the holder.
- [x] **Step 6: Verify Docker is down.** Quit Docker, or simulate it by running with `DOCKER_HOST=unix:///nonexistent`. `dev-start.sh` must exit 1 with the "start Docker" message.
- [x] **Step 7: Follow the skill end to end.** Read `SKILL.md` as an agent and use only what it says: start the app, then run the Playwright-plugin flow (items 1–6). It passes.
- [x] **Step 8: Checkpoint.** `pnpm format && pnpm lint`. List the changed files. Do not commit.

### Task 9: README and clean-state verification

**Files:**
- Create: `README.md`
- Modify: `docs/specs/project-foundation/spec.md` (status), this plan (status), `docs/specs/README.md` (index)

**Interfaces:**
- Consumes: everything above. The README uses the same scripts as the skill.

- [x] **Step 1: Write `README.md`.** It covers:
  - what Drum Tutor is (one paragraph, linking to `docs/PRD.md`, `docs/TECH_STACK.md`, `docs/adr/`, `docs/specs/`);
  - prerequisites (nvm, Docker);
  - first-time setup: `nvm install` → `nvm use` → `corepack enable` → `pnpm install` → `cp .env.example .env` → `pnpm db:up` → `pnpm db:migrate` → `pnpm dev`;
  - URLs (web `http://localhost:5330`, API `http://localhost:3330/api`, OpenAPI `http://localhost:3330/api/docs`);
  - the full commands table from spec §4.1 plus `dev:start`/`dev:stop`;
  - tests (`pnpm test`, Docker required);
  - lint and format;
  - resetting data;
  - working with agents (a pointer to `.claude/skills/local-dev`);
  - troubleshooting, filled in from what actually failed in Step 2.
- [x] **Step 2: Clean-state run.** Run `./scripts/dev-stop.sh; docker compose down -v; rm -rf node_modules apps/*/node_modules packages/*/node_modules .env .dev .turbo`. Then, in a fresh shell, execute the README's setup section literally, command by command. Record each result. For every mismatch, fix the README (or the script) and restart this step from the clean state. Expected: a clean pass with no deviation from the text.
- [x] **Step 3: Final checks.** `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Expected: all PASS. Paste the summary lines.
- [x] **Step 4: Final browser check.** Through the skill, `./scripts/dev-start.sh`, then the Playwright-plugin flow (Task 7 Step 3, items 1–6), then `./scripts/dev-stop.sh`.
- [x] **Step 5: Update the statuses.** Plan `done`. Spec `implemented`, with the specs index updated. Tick all the boxes in this plan. If execution required a decision or shortcut, add ADRs for it and update the ADR index.
- [x] **Step 6: Checkpoint.** `pnpm format`. List all the changed files, and the ADRs created or changed during execution. Ask the user whether to create a feature branch and commit. Do not do it unprompted.

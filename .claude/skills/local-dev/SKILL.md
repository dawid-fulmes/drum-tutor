---
name: local-dev
description: Start, check, stop or reset the Drum Tutor app locally (PostgreSQL in Docker, Fastify API, React web app), and drive it in a browser with the Playwright plugin for e2e checks. Use when asked to run/start/stop the app, see a change working in the browser, do an e2e or UI check, or reset local data.
---

# Running Drum Tutor locally

The app is PostgreSQL (Docker Compose), the API (Fastify, port 3330) and the web app (Vite, port 5330). The web dev server proxies `/api` to the API, so the browser only ever talks to `http://localhost:5330`. Background and decisions: ADR-0026, ADR-0027 and `README.md`.

Run every command from the repo root. Always use the scripts below; do not start `pnpm dev` yourself, pick other ports, or kill processes you did not start.

Your shell does not keep `nvm use` between commands. Run every `pnpm` command through `scripts/with-node.sh`, for example `scripts/with-node.sh pnpm test`. It selects the Node version from `.nvmrc`.

## Start

```bash
scripts/dev-start.sh
```

- Prints `ready` (or `already running`) plus the URLs, and exits 0. Only then is the app usable.
- Is idempotent: if the app is already healthy it reuses it instead of starting a second copy.
- Installs npm dependencies when needed, creates `.env` from `.env.example` if missing, starts the database and applies migrations.
- **Never** installs Node or pnpm and never starts Docker. When something is missing it exits 1 and prints the command a human must run. Relay that message to the user and stop; do not try to fix the machine yourself.

## Readiness

The app counts as ready **only** when this returns `{"status":"ok"}`:

```bash
curl -s http://localhost:5330/api/health
```

The check goes through the web proxy to the API and the database, so it proves all three are up. Never assume readiness from a started process or from elapsed time.

## Stop

```bash
scripts/dev-stop.sh               # stops API + web; the database keeps running
scripts/with-node.sh pnpm db:down # also stop the database (data is kept)
```

## Reset data

MVP data is disposable (ADR-0004). This gives a clean, empty, migrated database:

```bash
scripts/dev-stop.sh
scripts/with-node.sh pnpm db:reset
scripts/dev-start.sh
```

## Driving the UI with the Playwright plugin (e2e checks)

There is no committed Playwright suite yet (ADR-0027). UI checks use the Playwright plugin / MCP tools (`mcp__plugin_playwright_playwright__*`). If those tools are not available in your session, say so to the user. Do not switch to another browser tool or install Playwright into the repo.

- Base URL: `http://localhost:5330`. Start the app with `scripts/dev-start.sh` first.
- Use a fresh email per run so checks never collide with existing users: `<scope>-<unix-timestamp>@example.com`.
- Prefer `browser_snapshot` to read the page; take screenshots only as evidence.

Login / user creation flow (the baseline e2e check):

1. Open `/`. Expect a redirect to `/login`, with heading "Drum Tutor", field "Email" and button "Log in".
2. Submit `not-an-email`. Expect "Invalid email address" under the field and no request to `/api/auth/login`.
3. Submit the fresh email, mixing in uppercase letters and surrounding spaces (e.g. `  Check-123@Example.com `). Expect `/` with "Logged in as check-123@example.com" (trimmed and lowercased).
4. Reload. Expect to still be logged in.
5. Open `/login`. Expect a redirect back to `/`.
6. Click "Log out". Expect `/login`. Reload, and expect to stay on `/login`.
7. Optional, to check that logging in again finds the existing user: log in with the same email in different case. The API returns the same user id, which you can see in the `/api/auth/login` network response.

A `401` from `/api/auth/me` in the browser console is expected whenever nobody is logged in.

## Troubleshooting (`dev-start.sh` messages)

| Message | Meaning / what to do |
|---|---|
| `Node 24 is not installed. Run: nvm install` | Ask the user to run `nvm install` in the repo. |
| `nvm not found …` | nvm is missing. Ask the user to install it (see README). |
| `pnpm is not available …` | Ask the user to run `nvm use && corepack enable`. |
| `Docker is not running …` | Ask the user to start Docker Desktop. |
| `port 3330/5330 is in use by pid …` | Another process holds the port. If it is a stale Drum Tutor run, use `scripts/dev-stop.sh`. Otherwise ask the user; never kill it yourself. |
| `failed: pnpm dev exited early` / `not healthy after 90s` | Read the printed log tail (full log in `.dev/dev.log`) and fix the cause. A database port clash shows up as a `db:up` error: set `POSTGRES_PORT` and `DATABASE_URL` in `.env` to a free port. |

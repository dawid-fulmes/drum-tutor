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

For demo data (6 tags, 18 lessons, one practice log), run the seed after the reset. It replaces all lessons, tags and practice logs and keeps users, so it also works on a database that already has data:

```bash
scripts/with-node.sh pnpm db:seed
```

## Driving the UI with the Playwright plugin (e2e checks)

There is no committed Playwright suite yet (ADR-0027). UI checks use the Playwright plugin / MCP tools (`mcp__plugin_playwright_playwright__*`). If those tools are not available in your session, say so to the user. Do not switch to another browser tool or install Playwright into the repo.

- Base URL: `http://localhost:5330`. Start the app with `scripts/dev-start.sh` first.
- Use a fresh email per run so checks never collide with existing users: `<scope>-<unix-timestamp>@example.com`.
- Prefer `browser_snapshot` to read the page; take screenshots only as evidence.

Login / user creation flow (the baseline e2e check):

1. Open `/`. Expect a redirect to `/login`, with heading "Drum Tutor", field "Email" and button "Log in".
2. Submit `not-an-email`. Expect "Invalid email address" under the field and no request to `/api/auth/login`.
3. Submit the fresh email, mixing in uppercase letters and surrounding spaces (e.g. ` Check-123@Example.com`). Expect `/` with "Logged in as check-123@example.com" (trimmed and lowercased).
4. Reload. Expect to still be logged in.
5. Open `/login`. Expect a redirect back to `/`.
6. Click "Log out". Expect `/login`. Reload, and expect to stay on `/login`.
7. Optional, to check that logging in again finds the existing user: log in with the same email in different case. The API returns the same user id, which you can see in the `/api/auth/login` network response.

A `401` from `/api/auth/me` in the browser console is expected whenever nobody is logged in.

## Admin flows (e2e)

Every logged-in user is an admin for now. Seed first (`scripts/with-node.sh pnpm db:seed`) and log in with a fresh email. Admin screens live under `/admin` (`/admin/lessons`, `/admin/tags`); the drummer shell links nowhere into admin, so type the URLs.

Lessons list and form:

1. Open `/admin/lessons`. Expect the table with 18 seeded lessons (Name, Difficulty, Tags, Status, Created, Actions), "New lesson" button, "Per page 20". Changing page or page size changes `?page=&pageSize=` in the URL.
2. Open `/admin/lessons/new`. Expect tempo 60 BPM (slider and number input) and duration 03:00. Press "Decrease duration by 30 seconds" until it shows 00:30. Expect that button disabled; "Increase duration by 30 seconds" gives 01:00.
3. Type `320` into Tempo and leave the field. Expect "Tempo must be between 30 and 300 BPM". Set it back to `60`.
4. Click "Create lesson" with the form empty. Expect errors "Name is required", "Description is required", "Choose a difficulty", "Choose at least one tag". Expect no request to `POST /api/admin/lessons`. Picking a difficulty or tag, or typing a name or description, clears that field's error immediately.
5. Fill Name, Description, pick a difficulty, open the Tags picker, type in its search (the list narrows to matching tags, one request per debounced text), pick a tag, press Escape. Click "Create lesson". Expect the list with toast "Lesson created" and the new row as Draft. Double-clicking sends exactly one `POST`.
6. Row menu (Actions for ...) -> Edit. Change tags and tempo, "Save". Expect toast "Lesson saved". Reopen the edit page and expect the changes.
7. Row menu -> Publish: toast "Lesson published", badge Published. Row menu -> Move to draft: toast "Lesson moved to draft", badge Draft. Double-clicking an item sends one request.
8. Row menu -> Delete: dialog "Delete lesson?"; click Delete. Expect toast "Lesson deleted" and the row gone.
9. A locked lesson (it has practice logs; the seed has one, or insert a row with `docker compose exec postgres psql -U drum -d drum_tutor`) shows a lock icon with tooltip "Has practice logs"; Edit and Delete in its menu are disabled. Typing its `/admin/lessons/<id>/edit` URL shows the Alert "This lesson is locked" and a disabled form.
10. A malformed or unknown id (`/admin/lessons/not-a-uuid/edit`) shows "Lesson not found" with "Back to lessons".
11. Locked in another tab: open an edit page, insert a practice log for that lesson with psql, change a field and "Save". Expect a toast with the API message, then the locked Alert. Deleting the lesson with psql instead gives the toast "Lesson not found" and the "Lesson not found" page.

Tags:

12. Open `/admin/tags`. Expect the 6 seeded tags with "Used by" counts. Add "Odd meters" (toast "Tag added"), then "odd METERS". Expect the inline error `A tag named "odd METERS" already exists` and no toast.
13. Rename: the "Rename <name>" button, change the name, Enter (toast "Tag renamed"). Escape cancels. Search "hand" shows two rows.
14. Delete of a used tag is disabled with tooltip "Used by lessons"; delete of an unused one asks "Delete tag?" and removes it with toast "Tag deleted" (double-click sends one `DELETE`).
15. Infinite scroll: add more than 20 tags (loop `fetch('/api/admin/tags', { method: 'POST', ... })` through `browser_run_code_unsafe`, the browser carries the session cookie). Scroll to the bottom: pages 2 and 3 load once each, then no more requests. The tag picker in the lesson form scrolls the same way inside its popover.

Session lost (run this last, it wipes data):

16. With `/admin/lessons` open, run `scripts/with-node.sh pnpm db:reset`, then trigger any action or reload data (for example change the page size). Expect exactly one failed request (401), one redirect to `/login`, no error toast and no request loop (check `browser_network_requests`). Run `scripts/with-node.sh pnpm db:seed` and log in again before further checks.

## Library flows (e2e)

Seed first (`scripts/with-node.sh pnpm db:seed`: 6 tags, 15 published and 3 draft lessons) and log in with a fresh email. `/` redirects to `/lessons`. The router writes all search params into the URL, arrays as JSON (`tagIds=["<uuid>"]`), defaults included.

1. Open `/lessons`. Expect `/lessons?page=1&pageSize=12&tagIds=[]&difficulties=[]&sort=newest`, heading "Library", the controls Tags, Beginner / Intermediate / Advanced, Sort ("Newest first"), the text "15 lessons", 12 cards (name, difficulty badge, tag badges, "<bpm> BPM · m:ss") and the pagination bar with "Per page 12". Drafts never show.
2. Open the Tags picker, type `hand` in "Search tags". Expect "Hand speed" and "Weak hand". Pick "Weak hand", press Escape. Expect the button "Tags (1)", a chip for the tag, "4 lessons" and the id in `tagIds`. Several tags narrow the result (a lesson needs all of them).
3. Toggle "Intermediate". Expect "2 lessons" and `difficulties=["intermediate"]`. Several levels widen the result (any of them). Choose "Oldest first" in Sort. Expect `sort=oldest` and a different first card. "Clear filters" appears while a tag or level is selected; clicking it empties both (sort stays).
4. Back and forward. After steps 2 and 3, go back twice and forward once. Expect the controls (tag count, toggled levels, sort) and the cards to match the URL each time. Reload keeps the same state.
5. Paging: click "Go to next page" on the unfiltered library. Expect `page=2` and 3 cards. Per page offers 12, 24, 48; choosing 24 gives `pageSize=24`, `page=1`, 15 cards and no pagination bar.
6. Page clamping: open `/lessons?page=9`. Expect `page=2` (replaced, no extra history entry). On page 2 toggle a level. Expect `page=1`.
7. Garbage URL: open `/lessons?page=abc&pageSize=7&difficulties=["expert"]&sort=best&tagIds=["x"]`. Expect the library with defaults in the URL, never an error page.
8. Empty states: open `/lessons?page=3&tagIds=["<Rudiments id>","<Kick drum foot id>"]&difficulties=["beginner"]` (ids from `/api/tags` or psql). Expect "No lessons match these filters", "Try removing a tag or selecting more levels.", a "Clear filters" button, no redirect and no request loop; the button restores the full library. "No lessons yet" with "New lessons will show up here once they are published." shows on an empty database (see step 14).
9. Skeletons: in `browser_run_code_unsafe` register `page.route('**/api/lessons**', async r => { await new Promise(res => setTimeout(res, 2000)); await r.continue(); })`, then toggle a level and snapshot during the delay. Expect skeleton cards (as many as the page size) and no count text. Remove the route with `page.unroute`.
10. Deleted tag in the URL: pick a tag assigned to lessons, then with `docker compose exec postgres psql -U drum -d drum_tutor` run `delete from lesson_tags where tag_id = '<id>'` and `delete from tags where id = '<id>'`. Reload a URL that has this id plus another filter. Expect the dead id gone from the URL, results for the remaining filters, and one Back going to the previous page rather than to the dead-id URL. Re-seed afterwards.
11. Details: click a card. Expect `/lessons/<uuid>` with "‹ Back to library", name, badges, "Recommended: <bpm> BPM · m:ss", description, "Sheet coming soon" and a disabled "Start" button. "Back to library" returns to the library with the filters, sort and page you came from, also after a reload of the details page.
12. Not found: open `/lessons/abc`, a random uuid, and the id of a draft lesson (`select id from lessons where status = 'draft'`). Expect "Lesson not found" with "Back to library" each time, never the generic route error. The console shows the 400/404 resource errors.
13. Search the library and a details page for "rating", "No ratings", "0.0" and any notation: expect no match; the details page shows only the "Sheet coming soon" box (ADR-0030, ADR-0031).

Empty database (run this last, it wipes data):

14. `scripts/dev-stop.sh`, `scripts/with-node.sh pnpm db:reset`, `scripts/dev-start.sh`, log in again (reset deletes users). Expect "0 lessons" and "No lessons yet". Run `scripts/with-node.sh pnpm db:seed` afterwards.

## Troubleshooting (`dev-start.sh` messages)

| Message                                                   | Meaning / what to do                                                                                                                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Node 24 is not installed. Run: nvm install`              | Ask the user to run `nvm install` in the repo.                                                                                                                                                |
| `nvm not found …`                                         | nvm is missing. Ask the user to install it (see README).                                                                                                                                      |
| `pnpm is not available …`                                 | Ask the user to run `nvm use && corepack enable`.                                                                                                                                             |
| `Docker is not running …`                                 | Ask the user to start Docker Desktop.                                                                                                                                                         |
| `port 3330/5330 is in use by pid …`                       | Another process holds the port. If it is a stale Drum Tutor run, use `scripts/dev-stop.sh`. Otherwise ask the user; never kill it yourself.                                                   |
| `failed: pnpm dev exited early` / `not healthy after 90s` | Read the printed log tail (full log in `.dev/dev.log`) and fix the cause. A database port clash shows up as a `db:up` error: set `POSTGRES_PORT` and `DATABASE_URL` in `.env` to a free port. |

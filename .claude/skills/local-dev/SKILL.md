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

Signature editor (spec `signature` §7.3; cells are buttons named e.g. "Snare on 2&", comments are textboxes "Comment on 1"):

S1. `/admin/lessons/new` shows an empty grid, a preview with four quarter rests and "Add at least one note before publishing.". Toggling the money-beat cells turns the preview into the money beat and removes the note; a comment "R" on slot 1 shows above the first note.
S2. Toggle "Kick on 1", then "Hi-hat (closed) on 1", and create the lesson: the `POST` body has `["hihat-closed","kick"]` in slot 0; reopening the edit page shows the same cells and comment.
S3. Toggle cells, Cancel, then "New lesson" again: the grid is empty.
S4. Pasting `RLRL` into a comment leaves `RLR`. A comment `🥁` saves (201). A 4-character comment set past `maxLength` from script shows "A comment can be at most 3 characters" and sends no request.
S5. Publish the draft "Hi-hat foot chicks on 2&4" from its row menu: toast "Add at least one note to the signature before publishing", status stays Draft.
S6. Edit "Four on the floor", clear every cell and Save: 409 with the same toast, and the grid stays cleared after the refetch. Toggle "Kick on 1" and Save: 200. Re-seed afterwards.
S7. The edit page of the locked "Money beat" shows all 24 cells and 8 comments disabled, with its notation in the preview.

Tags:

12. Open `/admin/tags`. Expect the 6 seeded tags with "Used by" counts. Add "Odd meters" (toast "Tag added"), then "odd METERS". Expect the inline error `A tag named "odd METERS" already exists` and no toast.
13. Rename: the "Rename <name>" button, change the name, Enter (toast "Tag renamed"). Escape cancels. Search "hand" shows two rows.
14. Delete of a used tag is disabled with tooltip "Used by lessons"; delete of an unused one asks "Delete tag?" and removes it with toast "Tag deleted" (double-click sends one `DELETE`).
15. Infinite scroll: add more than 20 tags (loop `fetch('/api/admin/tags', { method: 'POST', ... })` through `browser_run_code_unsafe`, the browser carries the session cookie). Scroll to the bottom: pages 2 and 3 load once each, then no more requests. The tag picker in the lesson form scrolls the same way inside its popover.

Session lost (run this last, it wipes data):

16. With `/admin/lessons` open, run `scripts/with-node.sh pnpm db:reset`, then trigger any action or reload data (for example change the page size). Expect exactly one failed request (401), one redirect to `/login`, no error toast and no request loop (check `browser_network_requests`). Run `scripts/with-node.sh pnpm db:seed` and log in again before further checks.

## Library flows (e2e)

Seed first (`scripts/with-node.sh pnpm db:seed`: 6 tags, 15 published and 3 draft lessons) and log in with a fresh email. `/` redirects to `/lessons`. The router writes all search params into the URL, arrays as JSON (`tagIds=["<uuid>"]`), defaults included. The default sort is **Highest rated** (`sort=rating`, ADR-0058).

1. Open `/lessons`. Expect `/lessons?page=1&pageSize=12&tagIds=[]&difficulties=[]&sort=rating`, heading "Library", the controls Tags, Beginner / Intermediate / Advanced, Sort ("Highest rated"; options Highest rated, Newest first, Oldest first), the text "15 lessons", 12 cards (name, difficulty badge, tag badges, "<bpm> BPM · m:ss", and the rating `★ 4.7 (6)` or "No ratings yet") and the pagination bar with "Per page 12". Drafts never show.
2. Open the Tags picker, type `hand` in "Search tags". Expect "Hand speed" and "Weak hand". Pick "Weak hand", press Escape. Expect the button "Tags (1)", a chip for the tag, "4 lessons" and the id in `tagIds`. Several tags narrow the result (a lesson needs all of them).
3. Toggle "Intermediate". Expect "2 lessons" and `difficulties=["intermediate"]`. Several levels widen the result (any of them). Choose "Oldest first" in Sort. Expect `sort=oldest` and a different first card. "Clear filters" appears while a tag or level is selected; clicking it empties both (sort stays).
4. Back and forward. After steps 2 and 3, go back twice and forward once. Expect the controls (tag count, toggled levels, sort) and the cards to match the URL each time. Reload keeps the same state.
5. Paging: click "Go to next page" on the unfiltered library. Expect `page=2` and 3 cards. Per page offers 12, 24, 48; choosing 24 gives `pageSize=24`, `page=1`, 15 cards and no pagination bar.
6. Page clamping: open `/lessons?page=9`. Expect `page=2` (replaced, no extra history entry). On page 2 toggle a level. Expect `page=1`.
7. Garbage URL: open `/lessons?page=abc&pageSize=7&difficulties=["expert"]&sort=best&tagIds=["x"]`. Expect the library with defaults in the URL (`sort=rating`, Sort showing "Highest rated"), never an error page.
8. Empty states: open `/lessons?page=3&tagIds=["<Rudiments id>","<Kick drum foot id>"]&difficulties=["beginner"]` (ids from `/api/tags` or psql). Expect "No lessons match these filters", "Try removing a tag or selecting more levels.", a "Clear filters" button, no redirect and no request loop; the button restores the full library. "No lessons yet" with "New lessons will show up here once they are published." shows on an empty database (see step 14).
9. Skeletons: in `browser_run_code_unsafe` register `page.route('**/api/lessons**', async r => { await new Promise(res => setTimeout(res, 2000)); await r.continue(); })`, then toggle a level and snapshot during the delay. Expect skeleton cards (as many as the page size) and no count text. Remove the route with `page.unroute`.
10. Deleted tag in the URL: pick a tag assigned to lessons, then with `docker compose exec postgres psql -U drum -d drum_tutor` run `delete from lesson_tags where tag_id = '<id>'` and `delete from tags where id = '<id>'`. Reload a URL that has this id plus another filter. Expect the dead id gone from the URL, results for the remaining filters, and one Back going to the previous page rather than to the dead-id URL. Re-seed afterwards.
11. Details: click a card. Expect `/lessons/<uuid>` with "‹ Back to library", name, badges, "Recommended: <bpm> BPM · m:ss", description, the drum notation (`img` "Drum notation: one bar of 4/4") and the practice panel with "Start". "Back to library" returns to the library with the filters, sort and page you came from, also after a reload of the details page.
12. Not found: open `/lessons/abc`, a random uuid, and the id of a draft lesson (`select id from lessons where status = 'draft'`). Expect "Lesson not found" with "Back to library" each time, never the generic route error. The console shows the 400/404 resource errors.
13. Library cards show no notation. Ratings: see "Rating flows (e2e)" below.

Empty database (run this last, it wipes data):

14. `scripts/dev-stop.sh`, `scripts/with-node.sh pnpm db:reset`, `scripts/dev-start.sh`, log in again (reset deletes users). Expect "0 lessons" and "No lessons yet". Run `scripts/with-node.sh pnpm db:seed` afterwards.

## Rating flows (e2e)

Spec `rating` §7–§8. Seed first and log in as `seed@example.com`: the seed user rated "Money beat" 5 and "Single paradiddles" 4, completed "Weak hand eighth notes" without rating it, and never played "Four on the floor" or "Inverted paradiddles". The lesson page row under the badges holds the summary (`★ 4.3 · 12 ratings` / `★ 5.0 · 1 rating` / "No ratings yet", accessible text "Rated 4.3 out of 5 from 12 ratings") and the rate button. Stars in the modal are radios named "1 star" … "5 stars" in a radiogroup "Rating". Re-seed afterwards (`scripts/with-node.sh pnpm db:seed`).

R1. Library order: `/lessons` opens with "Highest rated". The first cards are Four on the floor `★ 4.7 (6)`, Money beat `★ 4.6 (5)`, Single strokes on a pad `★ 4.5 (6)`, Double strokes `★ 4.5 (2)` (equal averages: more ratings first); the unrated lessons come last with "No ratings yet". Newest first and back works; `?sort=best` shows the rating order with "Highest rated" selected.
R2. Never completed: "Four on the floor" shows a disabled "Rate this lesson" and "Complete this lesson once to rate it.".
R3. Completed, unrated: "Weak hand eighth notes" shows `★ 3.3 · 3 ratings` and an active "Rate this lesson". The modal "Rate Weak hand eighth notes" opens with no star selected and "Save" disabled. Keyboard: focus starts in the star group, arrow keys to "5 stars", Tab to "Save", Enter. The modal closes, focus returns to the button, the summary is `★ 3.8 · 4 ratings` and the button reads "Your rating: 5 ★" (accessible name "Change your rating, currently 5 out of 5"). In the library its card shows `★ 3.8 (4)`, between Disco offbeat hi-hat and Quarter-note kick control.
R4. Change and cancel: "Money beat" shows "Your rating: 5 ★"; the modal opens with "5 stars" selected and focused. Pick 2, "Cancel" (no `PUT`), reopen: 5 is selected again. Pick 3, "Save": the count stays 5, the summary is `★ 4.2 · 5 ratings`, and in the library Money beat drops from 2nd to 4th, after Double strokes.
R5. Unlock without a reload: open "Inverted paradiddles" (disabled button), set the duration to 0:30, Start and let it complete. After the `POST /api/practice-logs` the lesson detail is refetched and the button turns active while the panel keeps "Completed — 0:30 at <bpm> BPM logged.". Rate 4: `★ 4.0 · 1 rating`, and in the library it leaves the unrated tail.
R6. Stale page (409): open "Weak hand eighth notes" and its modal, then delete the seed user's logs for that lesson with `docker compose exec -T postgres psql -U drum -d drum_tutor -c "delete from practice_logs where lesson_id = '<id>' and user_id = (select id from users where email = 'seed@example.com')"`. Pick a star and "Save": the toast "Complete this lesson once before rating it", the modal stays open with the selection, and the button behind it returns to disabled with the call to action.
R7. Pager: delay `**/api/lessons?**` with `page.route` and change the page. While it loads the bar stays mounted with "Per page" disabled; a filter that matches nothing keeps it mounted and disabled too.
R8. Tag cap: with more than 20 tags (add them with `fetch('/api/admin/tags', …)` from `browser_run_code_unsafe`), select 20 in the library Tags picker. The other options are disabled with "You can select up to 20 tags"; clicking a selected one still removes it. The admin lesson form's picker has no cap and no hint.
R9. Dark mode: add the `dark` class to `<html>` (`document.documentElement.classList.add('dark')`). The stars, the summary and the cards' rating line are readable.

## Practice flows (e2e)

The practice panel lives on `/lessons/<id>` (spec `practice-and-stats` §6.2). The metronome is sound only, so checks read the scheduled clicks instead of listening. Seed first and log in. Before opening a lesson, install this recorder with `browser_run_code_unsafe` (it applies to every later navigation in that page):

```js
await page.addInitScript(() => {
  window.__clicks = [];
  window.__contexts = 0;
  const Original = window.AudioContext;
  window.AudioContext = class extends Original {
    constructor(...args) {
      super(...args);
      window.__contexts++;
    }
  };
  const start = OscillatorNode.prototype.start;
  OscillatorNode.prototype.start = function (when) {
    window.__clicks.push({ when, frequency: this.frequency.value });
    return start.call(this, when);
  };
});
```

Accented clicks are 1500 Hz, the others 1000 Hz. To fake a hidden page, run `Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange"))`, and set it back to `"visible"` afterwards. `scripts/with-node.sh pnpm db:seed` restores the seed afterwards.

1. Defaults: tempo and duration equal the lesson's recommendation. "Decrease duration by 30 seconds" stops at 00:30. Tempo `320` shows "Tempo must be between 30 and 300 BPM" and disables Start.
2. Count-in: at 120 BPM, Start gives 4 count-in clicks 0.5 s apart (the first at 1500 Hz), then exercise clicks 0.5 s apart with 1500 Hz on every 4th. While counting in, "Count-in" shows with the full duration, the notation is greyed out (`grayscale` on the SVG) and `[data-testid="count-in-number"]` reads 4, 3, 2, 1, changing on each count-in click. During play the SVG's `data-beat` goes 1, 2, 3, 4, 1, … on each exercise click; after Stop or completion it is gone.
3. Stop during play: setup is back, `__clicks` stops growing and there is no `POST /api/practice-logs`.
4. Double-click Start: `__contexts` grows by exactly 1.
5. Completion: a 0:30 session ends with "Completed — 0:30 at <bpm> BPM logged.", one `POST` with 201, and 4 + 60 clicks at 120 BPM. `GET /api/stats/daily` for one of the lesson's tags shows the 30 s today. "Practice again" keeps tempo and duration.
6. Hidden page during play: setup with "Session stopped because the app was in the background. Nothing was logged.", clicks stop and there is no `POST`.
7. Reload during play: no `POST`, and the page is in setup after the reload.
8. Leaving during play ("‹ Back to library", or moving to another lesson's URL): clicks stop at once, and the other lesson starts in setup with its own defaults.
9. Save failure: `page.route('**/api/practice-logs', r => r.abort())` before a 0:30 session ends. Expect "Completed, but your session isn't saved yet. Retrying…" with attempts about 1 s, 2 s and 4 s apart. Hiding the page keeps that state. "‹ Back to library" opens "Your session isn't saved yet. Leave anyway?", and "Stay" keeps the page. After `page.unroute(…)`, "Retry now" gives 201 and the saved message, with the tag's seconds for today up by exactly the session length (one log).
   9b. Real offline drop: open the library first (route chunks do not load offline in dev), then a lesson. Start a 0:30 session and call `page.context().setOffline(true)` just before it ends. Expect the retry state, not a stuck "Saving your session…". "Leave", then `setOffline(false)`: no `POST /api/practice-logs` follows.
10. Leave while unsaved: in the retry state, "Leave" navigates away and no `POST` follows in the next 10 s.
11. Rejected save: in the retry state, set the lesson to draft with `docker compose exec -T postgres psql -U drum -d drum_tutor -c "update lessons set status = 'draft' where id = '<id>'"`, unroute and click "Retry now". Expect 404 and "Your session couldn't be saved: This lesson is no longer available.". Set it back to `published`.
12. Lost session while saving: in the retry state, `page.context().clearCookies()`, unroute and click "Retry now". Expect a 401 and a redirect to `/login` without the leave dialog.

## Notation (e2e)

The lesson page draws the signature as a drum staff (spec `signature` §7.1). Seed first. Patch `OscillatorNode.prototype.start` only once per page (a second `addInitScript` records every click twice).

1. "Money beat": 8 x noteheads above the staff, kicks on 1 and 3, snares on 2 and 4, four beams, `1 & 2 & 3 & 4 &` below. "Single strokes on a pad": `R L R L R L R L` above the notes. "Quarter-note kick control": kicks with flags and eighth rests. "Offbeat snare reading": rests on the beats, snares on the "and"s. Screenshot the `img` element as evidence.
2. Visual beat timing: at 60 BPM sample `count-in-number`, `data-beat` and `__ctx.currentTime` every 50 ms. Each change lands within one sample of the matching recorded click.
3. End between beats: a 0:30 session at 70 BPM loses `data-beat` exactly at the end; nothing is highlighted after "Completed".
4. At a 375 px viewport the notation fits its card (the header's "Log out" overflows on its own, ADR-0047).

## Stats flows (e2e)

The stats screen is `/stats` (spec `practice-and-stats` §6.3). Seed first (`scripts/with-node.sh pnpm db:seed`) and log in as `seed@example.com`: the seed's 13 months of practice belong to that user. The chart is Recharts, so read values from the tooltip by hovering a bar (`page.mouse.move` over `.recharts-surface`).

1. The header shows "Stats". `/stats` writes `period=week&date=<today>` into the URL and shows "Select a tag to see your stats". There is no `/api/stats` request.
2. Pick "Groove" in "Select a tag". Expect `tagId` in the URL, one `GET /api/stats/daily` for Monday–Sunday of the current week, bars labelled Mon…Sun, no bars after today, and a tooltip like "Fri, Oct 23 · 23 min".
3. "Month" makes one daily call for the calendar month, labelled e.g. "October 2026". "Year" makes one weekly call for 1 Jan – 31 Dec, shows month ticks Jan…Dec, weekly bars up to the current week, and a tooltip like "Apr 27 – May 3 · 33 min".
4. Paging: "Previous period" in Year shows last year, with data from about 13 months ago. "Next period" is disabled on the current period. `?period=week&date=2027-01-01` is labelled "Dec 28, 2026 – Jan 3, 2027". From `?period=month&date=2026-01-31`, "Next period" shows February 2026.
5. URL state: reload keeps tag, period and date, and back/forward restore them. Switching from Month to Week keeps the date (the week containing it).
6. Garbage URL: `/stats?period=decade&date=2026-02-30&tagId=x` shows the current week without a tag.
7. Deleted tag: create a tag (`POST /api/admin/tags`), open Stats with it (all zeros), delete it, then reload. `tagId` leaves the URL (replace, so one Back leaves Stats) and the empty state shows.
8. Fresh practice: note today's minutes for a tag, complete a 0:30 session on a lesson with that tag, then go back to Stats with the browser Back (the header link opens Stats without a tag, so you would have to pick it again). Today's bar is 0.5 min higher without a manual reload (the save invalidates the stats queries).
9. Loading and error: delay `**/api/stats/**` by 2 s with `page.route` and expect a chart-sized skeleton; abort it and expect "Could not load data" with "Try again", which recovers once the route is removed.

After adding a dependency, restart the dev server (`scripts/dev-stop.sh`, `scripts/dev-start.sh`). Otherwise Vite re-optimizes deps on the first import and the open page briefly logs "Invalid hook call".

## Troubleshooting (`dev-start.sh` messages)

| Message                                                   | Meaning / what to do                                                                                                                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Node 24 is not installed. Run: nvm install`              | Ask the user to run `nvm install` in the repo.                                                                                                                                                |
| `nvm not found …`                                         | nvm is missing. Ask the user to install it (see README).                                                                                                                                      |
| `pnpm is not available …`                                 | Ask the user to run `nvm use && corepack enable`.                                                                                                                                             |
| `Docker is not running …`                                 | Ask the user to start Docker Desktop.                                                                                                                                                         |
| `port 3330/5330 is in use by pid …`                       | Another process holds the port. If it is a stale Drum Tutor run, use `scripts/dev-stop.sh`. Otherwise ask the user; never kill it yourself.                                                   |
| `failed: pnpm dev exited early` / `not healthy after 90s` | Read the printed log tail (full log in `.dev/dev.log`) and fix the cause. A database port clash shows up as a `db:up` error: set `POSTGRES_PORT` and `DATABASE_URL` in `.env` to a free port. |

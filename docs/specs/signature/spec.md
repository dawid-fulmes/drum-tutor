# Signature — Spec

- **Status:** implemented
- **Date:** 2026-10-26
- **Related:** PRD §4.1, §4.2, US-6, US-9, US-17, US-17a; R7, R11; ADR-0004, ADR-0005, ADR-0008, ADR-0016, ADR-0020, ADR-0021, ADR-0022, ADR-0040, ADR-0050 – ADR-0054
- **Plans:** [plan-01-backend.md](plan-01-backend.md), [plan-02-notation-and-player.md](plan-02-notation-and-player.md), [plan-03-admin-editor.md](plan-03-admin-editor.md)

## 1. Intent

This is the fourth MVP scope. It gives every lesson its **signature**: the one-bar drum pattern from PRD §4.2. Without it a drummer practices from the description and the click alone (ADR-0040).

Three things come out of it:

- **Admin:** a simple grid of toggle buttons in the lesson form. Columns are `1 & 2 & 3 & 4 &`, rows are instruments. The admin clicks cells to say what is played where and types sticking (e.g. `R` / `L`) per slot.
- **Drummer:** the lesson page draws the signature as close to real drum notation as practical: a five-line staff with a percussion clef and `4/4`, x noteheads for hi-hat, beamed eighth notes, rests, sticking above the notes.
- **Player:** the notation becomes the visual beat. During the 4 count-in clicks the notation is greyed out under a big game-style countdown `4 → 3 → 2 → 1`. During play, a vertical line lights up at the current quarter note on every click.

The product owner wants this **very simple but ready to grow**. The signature is stored as one JSON value tagged with a format version (`"v1"`). The backend validates it with a Zod schema from `packages/contracts`. A later richer format (other meters, sixteenths, more instruments, several bars) is added as `"v2"` next to `"v1"`, without migrating stored lessons (ADR-0050).

The path from the previous scopes applies unchanged: Zod contract in `packages/contracts` → Fastify route validated by it → Drizzle schema and migration → TanStack Query in the SPA → integration tests on real PostgreSQL.

## 2. Goals, non-goals, anti-goals

**Goals**

- A lesson always has a signature. `LessonInput`, the admin lesson and the drummer lesson detail carry it (US-17, US-6).
- The admin builds the signature in a grid editor with a live notation preview (US-17).
- A lesson can be published only when its signature has at least one note. Drafts may have an empty one (ADR-0053).
- The drummer lesson page shows the notation in place of the "Sheet coming soon" box (US-6, without rating).
- The count-in overlay and the quarter-note highlight are driven by the same audio clock as the clicks (US-8, US-9, ADR-0054).
- The seed is rebuilt from lessons that format v1 can actually express, with real patterns (paradiddles, four on the floor, money beat …), so the app is full of believable data for local testing.

**Non-goals (this scope)**

- Any format beyond v1: other meters, sixteenths, triplets, accents, ghost notes, flams, open hi-hat, toms, cymbals, hi-hat foot, several bars (ADR-0051).
- Two-voice notation (hands with stems up, kick with stems down and its own rests). v1 is drawn as one voice with all stems up (ADR-0051).
- Playing the pattern back as sound. The metronome still only clicks quarter notes (ADR-0005 stays true here).
- A slot-by-slot (eighth-note) highlight, a moving playhead, or scrolling.
- Notation on library cards or in the admin lessons table.
- Rating (US-12, US-13); US-6 stays unticked because of it.
- Mobile layout work; the app stays desktop-first (ADR-0047).
- A committed Playwright suite (ADR-0027 stays open).

**Anti-goals** — the scope fails if any of these happen, even if it "works"

- A published lesson has an empty signature (all rests), through publish, edit or seed.
- The API stores a signature that does not pass the contract schema, or the web app trusts an unvalidated shape.
- The version tag is missing from stored data, or adding a v2 would require rewriting stored v1 lessons.
- The highlight or the countdown visibly drifts from the clicks because it is timed with JS timers instead of the audio clock (ADR-0016).
- What the admin preview shows differs from what the drummer sees: both use the same renderer.
- A locked lesson's signature can be changed (R7).
- The seed contains a lesson whose description promises something its signature cannot show (e.g. a sixteenth-note groove drawn as eighths). The one exception is the draft lesson 17 in §5.1, which is empty on purpose and says so in its description.

## 3. Constraints

- Everything in [TECH_STACK.md](../../TECH_STACK.md) and the accepted ADRs applies, plus the patterns from the earlier scopes: error shape (ADR-0022), global mutation error toasts (ADR-0021), thin fetch client (ADR-0025), TanStack Form validated with contract schemas (ADR-0020), integration tests on real PostgreSQL (ADR-0018), UI verified with the Playwright plugin (ADR-0027).
- The notation is a hand-written React SVG component. No notation library such as VexFlow, abcjs or OSMD (ADR-0052). No new runtime dependency is needed for this scope.
- Colours come from the theme (`currentColor` / CSS variables), so the notation works in light and dark mode.
- Code, docs, UI text and test data in English.

## 4. The signature format (`packages/contracts`)

### 4.1 Shape

```ts
INSTRUMENTS = ["hihat-closed", "snare", "kick"] as const   // display order, top to bottom

SignatureSlotV1 = {
  instruments: Instrument[];  // 0–3 entries, no duplicates, order not meaningful; [] = rest
  comment: string;            // trimmed, 0–3 characters; "" = no comment (e.g. "R", "L", "RL")
}

SignatureV1 = {
  version: "v1";
  slots: SignatureSlotV1[];   // exactly 8: eighth-note slots of one 4/4 bar, slot 0 = beat 1
}

Signature = SignatureV1       // z.discriminatedUnion("version", [SignatureV1Schema])
```

Validation messages (shown in the admin form and in `400 VALIDATION_ERROR` details):

| Rule                          | Message                                        |
| ----------------------------- | ---------------------------------------------- |
| not exactly 8 slots           | "A signature has exactly 8 slots"              |
| unknown instrument            | "Unknown instrument"                           |
| an instrument twice in a slot | "An instrument can only appear once in a slot" |
| comment longer than 3         | "A comment can be at most 3 characters"        |
| unknown or missing `version`  | Zod's default discriminator message            |

Helpers exported next to the schema:

- `EMPTY_SIGNATURE_V1`: 8 slots of `{ instruments: [], comment: "" }`. It is the create-form default and the migration value.
- `signatureHasNotes(signature): boolean`: true when any slot has at least one instrument. The API (publish rule, §6.2) and the admin editor's hint (§7.3) use the same function.

A comment on an empty slot (a rest) is allowed and drawn above the rest.

**Package boundary.** `packages/db` does not depend on `packages/contracts` (stated in `schema.ts`), and this scope keeps it that way. The `jsonb` column gets a local structural type in `packages/db`. The migration writes the empty v1 value as an SQL literal. The seed writes its signatures as plain literals. That the seed matches the contract is checked by the seed test in `apps/api` (§8), which can import both packages.

### 4.2 Versioning rules (ADR-0050)

- `version` is a string literal per format: `"v1"` now, `"v2"` next.
- A new format is a new member of the discriminated union, with its own renderer and editor. Existing formats stay accepted and rendered. Stored lessons are never rewritten to a newer version.
- Whether an older version is still accepted on **write** once a newer one exists is decided by the scope that adds the newer version.

## 5. Data model (`packages/db`)

One migration:

| Change                                                                                                                                                                    | Why                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| add `signature jsonb not null` to `lessons`, filled with the empty v1 value for existing rows (added with a default, then the default is dropped, as in migration `0002`) | Every lesson has a signature. The column has no default afterwards; the API always writes it. |

There is no database check on the JSON structure. The Zod schema in `packages/contracts` is the single definition of the format, and only the API writes lessons (ADR-0050).

After migrating, existing published lessons have an empty signature, which the publish rule forbids. MVP data is disposable (ADR-0004): the local database is reset with `pnpm db:seed`, and there are no other environments.

### 5.1 Seed

`pnpm db:seed` keeps its structure from the previous scopes (tags, the seed user, 13 months of practice on three published lessons, `created_at` spread). The **lesson list is replaced** by the 18 lessons below. All of them can be written in v1. Lessons the old seed had that v1 cannot express (sixteenths, triplets, toms, flams, hi-hat foot patterns) are dropped.

Grid notation: `H` = `hihat-closed`, `S` = `snare`, `K` = `kick`, `-` = rest. Slots are separated by spaces; the comment is in parentheses.

| #   | Name                      | Difficulty   | Tempo | Min | Status    | Tags                              | Signature (slots 1 & 2 & 3 & 4 &)         |
| --- | ------------------------- | ------------ | ----- | --- | --------- | --------------------------------- | ----------------------------------------- |
| 0   | Single strokes on a pad   | beginner     | 60    | 3   | published | Hand speed, Weak hand             | S(R) S(L) S(R) S(L) S(R) S(L) S(R) S(L)   |
| 1   | Money beat                | beginner     | 80    | 5   | published | Groove                            | HK H HS H HK H HS H                       |
| 2   | Single paradiddles        | intermediate | 90    | 4   | published | Rudiments, Hand speed             | S(R) S(L) S(R) S(R) S(L) S(R) S(L) S(L)   |
| 3   | Quarter-note kick control | beginner     | 70    | 3   | published | Kick drum foot                    | K - K - K - K -                           |
| 4   | Four on the floor         | beginner     | 100   | 4   | published | Groove, Kick drum foot            | HK H HKS H HK H HKS H                     |
| 5   | Weak hand eighth notes    | intermediate | 75    | 5   | published | Weak hand                         | S(L) ×8                                   |
| 6   | Double strokes            | intermediate | 100   | 6   | published | Rudiments, Hand speed, Weak hand  | S(R) S(R) S(L) S(L) S(R) S(R) S(L) S(L)   |
| 7   | Inverted paradiddles      | intermediate | 85    | 4   | published | Rudiments, Weak hand              | S(R) S(L) S(L) S(R) S(L) S(R) S(R) S(L)   |
| 8   | Disco offbeat hi-hat      | intermediate | 110   | 5   | published | Groove, Kick drum foot            | K H KS H K H KS H                         |
| 9   | Rock beat with kick on 3& | beginner     | 85    | 5   | published | Groove, Kick drum foot            | HK H HS H HK HK HS H                      |
| 10  | Half-time groove          | intermediate | 70    | 5   | published | Groove                            | HK H H H HS H H HK                        |
| 11  | Linear eighths            | advanced     | 95    | 6   | published | Groove, Weak hand, Kick drum foot | K H(R) S(L) H(R) K K S(L) H(R)            |
| 12  | Offbeat snare reading     | beginner     | 70    | 3   | published | Weak hand                         | - S(L) - S(L) - S(L) - S(L)               |
| 13  | Syncopated kick groove    | advanced     | 90    | 6   | published | Groove, Kick drum foot            | HK H HS HK H HK HS H                      |
| 14  | Hand and foot alternation | beginner     | 80    | 3   | published | Kick drum foot, Hand speed        | K S(R) K S(L) K S(R) K S(L)               |
| 15  | Paradiddle groove         | advanced     | 80    | 5   | draft     | Rudiments, Groove                 | HK(R) S(L) H(R) H(R) SK(L) H(R) S(L) S(L) |
| 16  | Kick and snare call       | beginner     | 75    | 3   | draft     | Kick drum foot                    | K - S - K K S -                           |
| 17  | Hi-hat foot chicks on 2&4 | beginner     | 65    | 3   | draft     | Hi-hat foot, Groove               | empty (8 rests)                           |
- The lessons that get the seed user's practice history are **1, 2 and 5** (Money beat, Single paradiddles, Weak hand eighth notes). Together they cover Groove, Rudiments, Hand speed and Weak hand, as before.
- Lesson 17 is a deliberate draft with an empty signature: v1 has no hi-hat foot, so it cannot be written down yet. It lets local testing exercise the publish rule (§6.2). Its description says so.
- Every lesson gets a two-to-three sentence description in the tone of the current seed that matches its signature: what to play, what to focus on, and a tempo hint. Single-hand comments (`R`, `L`) appear only where the sticking is the point of the exercise. Grooves without comments rely on the standard right hand on the hi-hat.
- The tag "Hi-hat foot" stays in the dictionary and is only used by the draft lesson 17.
- A seed test asserts that every seeded signature passes `SignatureSchema` and that every published one has notes.

## 6. API contract

### 6.1 Shapes

```ts
LessonInput += { signature: Signature }; // required on create and update
LessonDetail += { signature: Signature }; // drummer GET /api/lessons/:id
AdminLesson += { signature: Signature }; // admin GET / POST / PUT / publish / unpublish responses
```

`LessonSummary` and `AdminLessonSummary` (lists) do **not** include the signature.

New error code: `SIGNATURE_EMPTY` (`409`), message "Add at least one note to the signature before publishing".

### 6.2 Rules

| Operation                             | Rule                                                                                                                                                                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/admin/lessons` (create)    | Any valid signature, including an empty one. The lesson starts as a draft (R11).                                                                                                                                                                                 |
| `PUT /api/admin/lessons/:id` (update) | Any valid signature for a draft. For a **published** lesson, an empty signature → `409 SIGNATURE_EMPTY` and nothing changes. A locked lesson → `409 LESSON_LOCKED` as before (R7).                                                                               |
| `POST …/:id/publish`                  | Signature without notes → `409 SIGNATURE_EMPTY`, even for an already published lesson. Otherwise as before (idempotent). This changes the `lessons-and-tags` rule "publishing does not require a signature" (ADR-0053); the route's response schema gains `409`. |
| `POST …/:id/unpublish`                | Unchanged.                                                                                                                                                                                                                                                       |
| `GET` (drummer and admin detail)      | Returns the stored signature as is.                                                                                                                                                                                                                              |
- An invalid signature in the body → `400 VALIDATION_ERROR` with `details` paths such as `signature.slots.3.comment` (ADR-0022).
- The publish check reads the signature in the same transaction as the status update.
- Lesson locking (R7) needs no new code: the signature is a lesson column, so editing it is covered by the existing lock.

## 7. Web app (`apps/web`)

### 7.1 The notation component

One React component draws a `Signature` and is used by both the lesson page and the admin preview. It switches on `version`. Only `v1` exists now.

**Drawing rules for v1** (as agreed on the brainstorming mockups):

- A five-line staff across the full width, a percussion clef (two short thick vertical bars), the time signature `4/4`, and a final barline.
- Eight equally spaced slot columns. Hi-hat = an **x** notehead in the space above the top line. Snare = a filled notehead in the third space from the bottom. Kick = a filled notehead in the bottom space.
- **One voice, all stems up.** Noteheads in one slot share a stem.
- **Beaming per quarter note:** the two slots of a beat are joined by one beam when both have notes. A lone eighth note in a beat gets a flag.
- **Rests:** an empty slot gets an eighth rest. When both slots of a beat are empty, one quarter rest stands at the beat position instead.
- **Comments** (sticking) are written above the notes, above the beams, centred on their slot.
- **Counting** `1 & 2 & 3 & 4 &` in small muted text below the staff.
- The SVG scales to its container's width, keeping its aspect ratio. Strokes and text use `currentColor` / theme tokens.
- Accessibility: the SVG has `role="img"` and an `aria-label` naming it drum notation. The builder may add a visually hidden text description of the slots.

**Pure layout.** Turning slots into glyphs (positions of noteheads, stems, beams vs flags, eighth vs quarter rests, comment and count positions) is a pure function with unit tests. The React component only draws its output.

### 7.2 Lesson page and visual beat

- The "Sheet coming soon" box is replaced by the notation, in a bordered card, above the practice panel. Everything else on the page stays.
- The notation has three looks, driven by the practice panel state:

| Panel state                                                                         | Notation                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup` (including after a stop), `saving`, `saved`, `save-failed`, `save-rejected` | Static.                                                                                                                                                                                             |
| `count-in`                                                                          | Greyed out (reduced opacity, desaturated). Centred on top, a large bold number on a translucent white plate (dark-mode equivalent in the dark theme) counts down **4 → 3 → 2 → 1**.                 |
| `playing`                                                                           | Static notation plus a highlight at the **current quarter note**: a vertical line through the staff at that beat's first slot, with a soft band behind it. It moves to the next beat on each click. |
- **Timing (ADR-0054).** Both visuals are derived from `audioContext.currentTime` in the panel's existing animation-frame loop, from the existing click plan:
  - count-in number = `4 − i`, where `i` is the index of the latest count-in click already due (`0` before the first click, so `4` shows from the start of the count-in);
  - current beat = `floor((now − exerciseStart) / beatSeconds) mod 4`, from `exerciseStart` on.
  - Both are pure functions with unit tests next to the click schedule.
- The existing "Count-in" label and the timer in the panel stay as they are.
- The highlight is not shown for a beat at or after the exercise end. Stop and completion return the notation to static immediately.

### 7.3 Admin signature editor

- A **Signature** section in the lesson form, after the duration field, used by create and edit.
- **Grid:** a header row `1 & 2 & 3 & 4 &`. Then one row per instrument, labelled **Hi-hat (closed)**, **Snare**, **Kick**, each with 8 toggle buttons. Clicking a cell toggles that instrument in that slot. The cells on beats (`1`, `2`, `3`, `4`) have a stronger border than the `&` cells.
  - Each cell is a button with `aria-pressed` and an accessible name such as "Snare on 2&".
- **Comment row:** under the grid, labelled **Comment**, one small text input per slot, `maxLength` 3.
- **Preview:** under the grid, the notation component (§7.1) draws the current value live.
- Hint text: "An empty column is a rest. Comments are optional, e.g. R or L."
- **Empty-signature note:** while `signatureHasNotes` is false, the section shows a muted note: "Add at least one note before publishing." It does not block saving a draft. The admin lessons table gets no new flag. Publishing an empty lesson from the table is answered by the toast below, so the list contract stays unchanged.
- **Defaults:** a new lesson starts with `EMPTY_SIGNATURE_V1`. Editing loads the stored signature.
- **Validation:** the form validates `signature` with the contract schema like every other field (ADR-0020). Errors show under the section.
- **Locked lessons:** the grid and the comment inputs are disabled, like the other fields (R7).
- **Publishing an empty signature:** the `409 SIGNATURE_EMPTY` message reaches the admin through the global error toast (ADR-0021), wherever publish is triggered. Saving a published lesson with an empty signature shows the same message the same way.

## 8. Tests

**Contract unit tests:** `SignatureSchema` accepts the 8-slot shapes from the seed table; rejects 7 or 9 slots, an unknown instrument, a duplicate instrument in a slot, a 4-character comment, a missing or unknown `version`; trims comments. `signatureHasNotes` for an empty and a one-note signature. `LessonInput` requires `signature`.

**API integration tests** (ADR-0018):

- create with a full and with an empty signature → `201`, stored and returned as sent;
- invalid signature → `400` with the field path in `details`;
- publish with an empty signature → `409 SIGNATURE_EMPTY`, status unchanged; with notes → `200`;
- `PUT` a published lesson to an empty signature → `409 SIGNATURE_EMPTY`, nothing changed; a draft to an empty signature → `200`;
- `PUT` on a locked lesson still → `409 LESSON_LOCKED`;
- drummer `GET /api/lessons/:id` returns the signature; the library list does not.

**Seed test:** every seeded signature parses; every published lesson's signature has notes; the logged lessons are the ones in §5.1.

**Web unit tests** (pure functions only): the notation layout (a full money beat, a beat with one empty slot giving a flag and an eighth rest, a fully empty beat giving a quarter rest, comment and count positions); the count-in number and the current beat from the click plan, including the boundaries at each click and at the exercise end.

**UI verification** (ADR-0027) through the `local-dev` skill and the Playwright plugin, after `db:seed`:

- lesson page: the notation of Money beat and Single strokes matches the seed table (noteheads, beams, sticking above); Start → greyed notation with `4 3 2 1` → highlight moves through beats 1–4 with the clicks → Stop returns to static;
- admin: create a lesson, toggle cells and type comments, the preview follows; save, reopen, the grid shows the stored value; publishing the seeded draft "Hi-hat foot chicks on 2&4" shows the `SIGNATURE_EMPTY` toast; a locked lesson shows a disabled grid.

The `local-dev` skill's e2e section is updated with these flows.

## 9. Plans

- **`plan-01-backend.md`:** contract schema and helpers, migration, API changes and the `SIGNATURE_EMPTY` rule, the new seed, contract, integration and seed tests. Verifiable through tests and `/api/docs`.
- **`plan-02-notation-and-player.md`:** the layout function and the notation component, the lesson page card, the count-in overlay and the quarter-note highlight with their unit tests. Verifiable in the browser against the seed.
- **`plan-03-admin-editor.md`:** the grid editor with preview in the lesson form, defaults, validation, locked state. Verifiable in the browser.

Plans 02 and 03 depend on 01. Plan 03 reuses the notation component from plan 02.

## 10. Decisions recorded with this scope

| ADR                                                                      | Decision                                                                                                                            |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [ADR-0050](../../adr/0050-versioned-json-signature-validated-by-zod.md)  | Store the signature as versioned JSON in a `jsonb` column, validated only by a Zod discriminated union                              |
| [ADR-0051](../../adr/0051-signature-v1-single-voice-drum-staff.md)       | Signature format v1: one 4/4 bar of eighths, three instruments, drawn as a single-voice drum staff (supersedes ADR-0005, tech-debt) |
| [ADR-0052](../../adr/0052-hand-drawn-svg-notation-without-library.md)    | Draw the notation as a hand-written SVG component instead of using a notation library                                               |
| [ADR-0053](../../adr/0053-publishing-requires-a-signature-with-notes.md) | A published lesson must have a signature with at least one note; drafts may have an empty one                                       |
| [ADR-0054](../../adr/0054-visual-beat-on-the-notation.md)                | Show the count-in and the current quarter note on the notation, driven by the audio clock (repays ADR-0040)                         |

Status changes: ADR-0005 → `superseded by ADR-0051` when the spec is approved; ADR-0040 → `repaid in ADR-0054` when plan 02 is done (the notation and the visual beat reach the lesson page there; until then the running app still has the debt). ADR-0054 repays the visual beat, and its text points to ADR-0050 and ADR-0053 for the other half of ADR-0040's debt (published lessons without a signature).

When the spec is approved, ADR-0050, 0052, 0053 and 0054 move from `proposed` to `accepted`, and both indexes (`docs/adr/README.md`, `docs/specs/README.md`) are updated in the same change.

## 11. PRD tracking

When all plans are done:

- tick **US-17** with `signature` as the delivering scope;
- US-6 stays unticked (rating still missing). Note that its signature part is delivered by `signature`;
- in §4.2, add that a signature is stored with a format version, is drawn as drum notation, and must have at least one note before the lesson is published (ADR-0050, ADR-0051, ADR-0053);
- in §8 ("richer notation" in the out-of-scope list) and the §2 non-goals, point to ADR-0051.

## 12. Left to the builder

- Exact SVG geometry: staff spacing, glyph shapes (clef, x notehead, flags, rests), stroke widths, the highlight's colour and band width, as long as §7.1 and §7.2 hold.
- Whether the grid cells use plain buttons with `aria-pressed` or a stock shadcn `toggle` component.
- How the panel state reaches the notation (props, a small hook, lifting state), as long as the timing comes from the audio clock.
- The exact seed descriptions, within §5.1.
- Module layout (e.g. `features/signature/` for the layout function and component).

## 13. Claude's calls

- Comments are at most 3 characters and always present as a string (`""` = none), so the form and the JSON stay uniform.
- Instrument order inside a slot is not meaningful and is stored as sent. Duplicates are rejected.
- An empty slot draws an eighth rest; a fully empty beat draws one quarter rest.
- One voice, all stems up (the product owner kept this after seeing the two-voice option described).
- Counting `1 & 2 & …` is shown under the staff (shown on the mockups, kept by the product owner).
- After Stop or completion the notation returns to static.
- The count-in shows `4` from the start of the count-in, then `3`, `2`, `1` on the following clicks.
- A published lesson cannot be saved with an empty signature, not just not published, so "published ⇒ has notes" always holds.
- No database check on the JSON; the Zod contract is the single definition.
- The seed drops lessons v1 cannot express and adds v1-friendly ones; one draft deliberately has an empty signature.
- Notation is not shown on library cards or in the admin table.
- The admin learns that an empty lesson cannot be published from a note in the editor and from the `409` toast. The admin list gets no "publishable" flag.
- A comment over a rest is allowed and drawn.

## Changelog

- 2026-10-26 — ADR-0040 is marked repaid when plan 02 is done, not on spec approval (found in the plan-01 final review: the lesson page still has no notation after plan 01).

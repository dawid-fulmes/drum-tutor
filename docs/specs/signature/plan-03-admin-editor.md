# Signature — Plan 03: Admin editor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
- **Status:** done

**Goal:** Spec §7.3: a **Signature** section in the admin lesson form. It has a 3 × 8 grid of toggle buttons (rows Hi-hat (closed), Snare, Kick; columns `1 & 2 & 3 & 4 &`), a comment input per slot, and a live notation preview. It also gets validation, the locked state and the empty-signature note. The plan closes the `signature` scope (PRD tracking, spec status).

**Architecture:** Two pure functions build a new `SignatureV1` from the old one (toggle an instrument, set a comment) and never mutate their input, so the shared `EMPTY_SIGNATURE_V1` default stays intact. `SignatureField` is a TanStack Form field component in the style of `TempoField` / `DurationField`. It renders the grid with the stock shadcn `Toggle`, the comment `Input`s, and the `SignatureNotation` preview from plan 02. The form validates `signature` with the contract schema like every other field (ADR-0020).

**Tech Stack:** React 19, TanStack Form, shadcn/ui (`Toggle`, `Input`, `Label`), Vitest (node environment, pure functions only). No new dependencies.

**Spec:** [spec.md](spec.md) · **Depends on:** [plan-01-backend.md](plan-01-backend.md) and [plan-02-notation-and-player.md](plan-02-notation-and-player.md) done.

## Global Constraints

- [spec.md](spec.md) wins over this plan if they disagree. Raise the conflict instead of picking one silently.
- **Git:** commit only when the user explicitly asks (their global rule). Each task ends with a checkpoint listing its files. If the user has asked for commits: to `main`, short imperative message, no AI attribution. Never branch, push, stash, rebase or reset.
- Run every `pnpm` command through `scripts/with-node.sh`. Run typecheck as `pnpm typecheck --force`.
- No new npm dependencies; only stock components already in `src/components/ui`.
- The preview is the plan-02 `SignatureNotation`, so admin and drummer see the same drawing (spec anti-goal). No second renderer.
- The frontend never decides publishability on its own: the empty-signature note is a hint. The API's `409 SIGNATURE_EMPTY` is the rule, shown through the global error toast (ADR-0021, ADR-0053).
- Run `scripts/with-node.sh pnpm format` before closing each task.
- Any shortcut or `TODO` needs a tech-debt ADR, and the comment must read `// TODO(ADR-NNNN): …`.

**Exact copy** (spec §7.3)

| Where                         | Text                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| section label                 | `Signature`                                                                                                 |
| column headers                | `1`, `&`, `2`, `&`, `3`, `&`, `4`, `&`                                                                      |
| row labels                    | `Hi-hat (closed)`, `Snare`, `Kick`; comment row `Comment`                                                   |
| cell accessible name          | `{Instrument row label} on {slot}`, slots `1 1& 2 2& 3 3& 4 4&`, e.g. `Snare on 2&`, `Hi-hat (closed) on 1` |
| comment input accessible name | `Comment on {slot}`, e.g. `Comment on 3&`                                                                   |
| preview label                 | `Preview`                                                                                                   |
| hint                          | `An empty column is a rest. Comments are optional, e.g. R or L.`                                            |
| empty-signature note          | `Add at least one note before publishing.`                                                                  |
| toast on 409 (from the API)   | `Add at least one note to the signature before publishing`                                                  |

## Review Focus

1. **Shared default mutated.** Creating a lesson, toggling cells, cancelling and opening "New lesson" again must show an empty grid. `EMPTY_SIGNATURE_V1` is never mutated (plan-01 final review, deferred minor). Unit-tested in Task 1; checked in the browser in Task 2.
2. **Comment longer than 3 characters pasted** (`RLRL`) is cut by `maxLength`, and an emoji comment that the browser counts as 2 units still saves when Zod counts it as 1 code point. Neither path may leave a form that can't be submitted without an error message. Checked in Task 2.
3. **Edit then save of a locked lesson.** The grid and comments are disabled, so the stored signature cannot change (R7). Checked in Task 2.
4. **Saving a published lesson after emptying its grid** gives the `SIGNATURE_EMPTY` toast. The edit page refetches on `409` (existing behaviour), and that refetch must not wipe the admin's unsaved grid, so they can add a note and save again. Checked in Task 2.
5. **Instrument order in stored JSON.** Toggling `kick` then `hihat-closed` in a slot stores `["hihat-closed", "kick"]` (display order). A re-save of an unchanged form sends an identical signature. Unit-tested in Task 1.

---

### Task 1: Signature edit functions

**Files:**

- Create: `apps/web/src/features/signature/signature-edit.ts`
- Test: `apps/web/src/features/signature/signature-edit.test.ts`

**Interfaces:**

- Consumes: `SignatureV1`, `Instrument`, `INSTRUMENTS`, `EMPTY_SIGNATURE_V1` from contracts.
- Produces:
  - `toggleInstrument(signature: SignatureV1, slot: number, instrument: Instrument): SignatureV1`. It adds the instrument if absent and removes it if present. The slot's list stays in `INSTRUMENTS` order. It returns a new object with a new `slots` array and a new slot object for the changed slot.
  - `setComment(signature: SignatureV1, slot: number, comment: string): SignatureV1`: the same immutability. It stores the raw string; trimming is the schema's job on submit.
  - `SLOT_LABELS = ["1", "1&", "2", "2&", "3", "3&", "4", "4&"] as const` and `COLUMN_HEADERS = ["1", "&", "2", "&", "3", "&", "4", "&"] as const`.
  - `INSTRUMENT_LABELS: Record<Instrument, string>` = `{ "hihat-closed": "Hi-hat (closed)", snare: "Snare", kick: "Kick" }`.

- [x] **Step 1: Write the failing tests:**
  - toggling `snare` on slot 3 of `EMPTY_SIGNATURE_V1` gives `instruments: ["snare"]` at slot 3 and `[]` elsewhere; toggling again gives `[]`;
  - `EMPTY_SIGNATURE_V1` deep-equals a fresh `{ version: "v1", slots: 8 × { instruments: [], comment: "" } }` after both calls (structuredClone it before, compare after);
  - the result's `slots` array and the changed slot are new references, and unchanged slots are the same references;
  - toggling `kick` then `hihat-closed` on one slot gives `["hihat-closed", "kick"]`; adding `snare` gives `["hihat-closed", "snare", "kick"]`;
  - `setComment(sig, 0, "R")` sets slot 0's comment and leaves the input unchanged;
  - `SLOT_LABELS` and `INSTRUMENT_LABELS` match the copy table.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/web test -- signature-edit`. Expected: FAIL, module missing.
- [x] **Step 3: Implement** the Interfaces in `signature-edit.ts`.
- [x] **Step 4: Run** the test. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Files: the two above.

### Task 2: Signature field in the lesson form

**Files:**

- Create: `apps/web/src/features/admin-lessons/signature-field.tsx`
- Modify: `apps/web/src/features/admin-lessons/lesson-form.tsx`
- Modify (docs): `.claude/skills/local-dev/SKILL.md` (Admin flows), this plan

**Interfaces:**

- Consumes: Task 1 functions and labels; plan-02 `SignatureNotation`; `signatureHasNotes`, `LessonInputSchema.shape.signature` from contracts.
- Produces: `SignatureField({ field, disabled }: { field: AnyFieldApi; disabled?: boolean })`.

- [x] **Step 1: Build `SignatureField`.**
  - A `fieldset` with legend `Signature`, then a CSS grid of 9 columns (a row-label column plus 8 slot columns).
  - Header row: `COLUMN_HEADERS`, with beat columns (`1 2 3 4`) in normal weight and the `&` columns muted.
  - One row per instrument in `INSTRUMENTS` order: the label, then 8 shadcn `Toggle`s (`variant="outline"`). Each has `pressed` = the slot contains the instrument, `onPressedChange` → `field.handleChange(toggleInstrument(value, slot, instrument))`, `aria-label` from the copy table and `disabled`. Pressed cells use a strong filled style (e.g. `data-[state=on]:bg-foreground data-[state=on]:text-background`). Beat columns get a stronger border than `&` columns.
  - Comment row: label `Comment`, then 8 `Input`s with `maxLength={3}`, the copy-table `aria-label`, `value` = the slot's comment, and `onChange` → `field.handleChange(setComment(value, slot, event.target.value))`. They are disabled with the field. Each input is centred and narrow.
  - The hint text (muted) under the grid, then the field error (if touched: the first error message, `text-destructive`, as in `TempoField`). While `!signatureHasNotes(value)`, the muted empty-signature note.
  - Under it: label `Preview` and `<SignatureNotation signature={value} />` in a bordered box.
- [x] **Step 2: Add it to `LessonForm`** after the duration field: `<form.Field name="signature" validators={{ onChange: shape.signature, onBlur: shape.signature }} listeners={clearStaleErrors}>` rendering `<SignatureField field={field} disabled={locked} />`.
- [x] **Step 3: Run** `scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm typecheck --force && scripts/with-node.sh pnpm test`. Expected: all PASS.
- [x] **Step 4: Verify in the browser** (`local-dev` skill, Playwright plugin, after `db:seed`, fresh email):
  - **New lesson:** `/admin/lessons/new` shows the Signature section with an empty grid, an empty preview (4 quarter rests) and the empty-signature note.
    - Click `Hi-hat (closed) on 1` … `on 4&`, `Kick on 1`, `Kick on 3`, `Snare on 2`, `Snare on 4`. The preview turns into the money beat and the note disappears.
    - Type `R` into `Comment on 1`; it appears above the first note in the preview.
    - Fill the other fields and Create. The lesson is saved as a draft; reopening its edit page shows the same grid and comment.
  - **Review Focus 1:** in a new lesson form, toggle two cells, Cancel, then open `/admin/lessons/new` again (client-side navigation, no reload). The grid is empty.
  - **Review Focus 2:**
    - Paste `RLRL` into a comment: the input holds `RLR`.
    - Type `🥁` into a comment and save: `201`.
    - Send a comment of 4 code points through `browser_run_code_unsafe` (bypassing `maxLength`): the field shows "A comment can be at most 3 characters" and no request is sent.
  - **Publish rule:** publish the seeded draft "Hi-hat foot chicks on 2&4" from the table row menu. The toast shows the copy-table 409 message and the row stays Draft.
  - **Review Focus 4:**
    - Open the edit page of an unlocked published lesson (e.g. "Four on the floor"), clear all its cells and Save. The 409 toast appears and the grid keeps the cleared state.
    - Toggle `Kick on 1` and Save: `200`, back on the list.
    - Re-seed afterwards.
  - **Review Focus 3:** the edit page of a locked lesson ("Money beat") shows the grid toggles and comment inputs disabled, with the notation preview of its signature.
  - **Review Focus 5:** in a new lesson, toggle `Kick on 1` then `Hi-hat (closed) on 1`, Create, and check the `POST` body has `["hihat-closed","kick"]` in slot 0.
- [x] **Step 5: Update the `local-dev` skill's Admin flows** with the checks above, as steps after the current form steps.
- [x] **Step 6: Checkpoint.** `pnpm format`. Files: the files of this task.

### Task 3: Close the scope

**Files:**

- Modify: `docs/PRD.md`, `docs/specs/signature/spec.md` (status, Plans links), `docs/specs/README.md`, this plan

- [x] **Step 1: PRD tracking** (spec §11):
  - Tick **US-17** and add `US-17: signature` to the delivering-scope sentence above the story list.
  - Leave US-6 unticked, and add after it: "_(signature part delivered by `signature`; rating still missing.)_".
  - In §4.2 add: "The signature is stored with a format version (`v1` today) and drawn as drum notation. A lesson can be published only when its signature has at least one note (ADR-0050, ADR-0051, ADR-0053)."
  - In §8, point "richer notation" to ADR-0051.
- [x] **Step 2: Spec and index.** Set the spec's status to `implemented`. Check that its **Plans** links resolve. In `docs/specs/README.md`, set the signature row to `implemented` with all three plans `(done)`.
- [x] **Step 3: Run** `scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm typecheck --force && scripts/with-node.sh pnpm test`. Expected: all PASS.
- [x] **Step 4: Checkpoint.** `pnpm format` (and `npx prettier --write` on the touched Markdown, as before). Tick this plan's checkboxes and set its status to `done`. Files: the docs above.

## Execution notes

<!-- Filled in during execution: any decision taken while building. -->

- **Commits.** None during execution; the user commits when they ask.
- **Task 2.** Pressed cells keep their dark fill on hover (`data-[state=on]:hover:bg-foreground/85`). The stock `Toggle` hover style otherwise turned a pressed cell grey under the pointer.
- **Task 2, browser check (2026-10-26).** Every Review Focus item passed:
  - cancel → new lesson gives an empty grid;
  - `RLRL` is cut to `RLR`; `🥁` saves with 201; a 4-character comment set from script shows the schema message and sends no request;
  - publishing the empty draft gives the 409 toast and the lesson stays a draft;
  - emptying "Four on the floor" gives 409 and the grid stays cleared after the refetch; adding a kick then saves with 200;
  - the locked "Money beat" has all 24 cells and 8 comments disabled, with its preview drawn;
  - slot 0 is posted as `["hihat-closed","kick"]`.
- **Task 3.** Markdown is formatted with `pnpm format` (Biome), not `npx prettier` (plan-02 Execution notes).
- **Final review fix.** `SignatureField` switches on `signature.version` and returns `ReactElement`, like the renderer, so a future version needs its own editor before it typechecks (probed with a temporary `v2`). Comment inputs still have no `aria-invalid` / `aria-describedby`, deferred as minor: `maxLength` already blocks the only invalid case.

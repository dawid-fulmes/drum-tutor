# Signature — Plan 02: Notation and player

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Status:** approved

**Goal:** Spec §7.1 and §7.2: the lesson page draws the signature as a drum staff in place of "Sheet coming soon". During the count-in the notation is greyed out under a big `4 → 3 → 2 → 1`. During play a vertical line marks the current quarter note on each click.

**Architecture:** A pure layout function turns a `SignatureV1` into glyph coordinates in a fixed SVG coordinate space. A `SignatureNotation` React component switches on `version` and only draws that layout, plus an optional visual state (static / count-in number / playing beat). Two pure timing functions next to the click schedule derive the count-in number and the current beat from the audio clock. `PracticePanel` renders the notation card above its controls and feeds it from its existing animation-frame loop. Everything with a rule in it is unit-tested; drawing is checked in the browser (no component-test setup, ADR-0027).

**Tech Stack:** React 19, SVG, Tailwind with theme tokens, Vitest (node environment, pure functions only). No new dependencies (ADR-0052).

**Spec:** [spec.md](spec.md) · **Depends on:** [plan-01-backend.md](plan-01-backend.md) done. [plan-03-admin-editor.md](plan-03-admin-editor.md) reuses the component from this plan.

## Global Constraints

- [spec.md](spec.md) wins over this plan if they disagree. Raise the conflict instead of picking one silently.
- **Git:** commit only when the user explicitly asks (their global rule). Each task ends with a checkpoint listing its files. If the user has asked for commits: to `main`, short imperative message, no AI attribution. Never branch, push, stash, rebase or reset.
- Run every `pnpm` command through `scripts/with-node.sh`. Run typecheck as `pnpm typecheck --force` (turbo's typecheck cache ignores dependency changes, plan-01 Execution notes).
- No new npm dependencies; no notation library (ADR-0052).
- The count-in number and the beat highlight are derived from `AudioContext.currentTime` through the existing `ClickPlan`, never from JS timers or `Date.now()` (ADR-0016, ADR-0054).
- Strokes, fills and text of the notation use `currentColor` or theme tokens (`text-foreground`, `text-muted-foreground`, `bg-background`, `text-primary`), so it works in light and dark mode.
- The layout function is the only place with geometry; the component does no positioning maths of its own.
- Run `scripts/with-node.sh pnpm format` before closing each task.
- Any shortcut or `TODO` needs a tech-debt ADR, and the comment must read `// TODO(ADR-NNNN): …`.

**Exact copy**

| Where                    | Text                                   |
| ------------------------ | -------------------------------------- |
| notation `aria-label`    | `Drum notation: one bar of 4/4`        |
| counting under the staff | `1 & 2 & 3 & 4 &` (one label per slot) |
| count-in overlay         | `4`, `3`, `2`, `1`                     |

## Review Focus

1. **Highlight right after the count-in.** The count-in machine event (`count-in-done`) and the audio clock are separate signals. Between them, the overlay must not show `0` or a fifth number, and the highlight must start at beat 1 exactly at `exerciseStart`. `countInNumber` clamps to 1–4, and `currentBeat` is `null` before `exerciseStart`. Unit-tested in Task 2.
2. **Exercise end mid-bar.** When the duration ends between beats (e.g. 30 s at 70 BPM), the highlight disappears at `end`, not one beat later, and never wraps to beat 1 after the end. Unit-tested in Task 2.
3. **Re-render cost.** The frame loop runs about 60 times a second, but the notation may only re-render when the number or beat changes. Store primitives in state, so React skips identical updates. Checked in Task 3 with React DevTools profiling or a render counter during a browser check, removed afterwards.
4. **A slot with all three instruments** (`HSK`) draws three noteheads on one stem without the stem crossing the x notehead. **A comment on a rest** is drawn above the rest. Unit-tested in Task 1 (stem spans from the lowest to above the highest notehead; comment present for a rest slot).
5. **Narrow containers.** The SVG scales down with its `viewBox` and never overflows the lesson column (`max-w-2xl`) or the admin form. Checked in Task 3 at a 375 px wide viewport.

---

### Task 1: Notation layout

**Files:**

- Create: `apps/web/src/features/signature/notation-layout.ts`
- Test: `apps/web/src/features/signature/notation-layout.test.ts`

**Interfaces:**

- Consumes: `SignatureV1`, `Instrument`, `SIGNATURE_V1_SLOTS` from `@drum-tutor/contracts`.
- Produces:

```ts
export type NoteheadGlyph = {
  x: number;
  y: number;
  instrument: Instrument;
  shape: "x" | "filled";
};
export type StemGlyph = { x: number; yTop: number; yBottom: number };
export type BeamGlyph = { x1: number; x2: number; y: number };
export type FlagGlyph = { x: number; y: number }; // attached at the stem top
export type RestGlyph = { x: number; y: number; kind: "eighth" | "quarter" };
export type TextGlyph = { x: number; y: number; text: string };

export type NotationLayout = {
  width: number; // viewBox width
  height: number; // viewBox height
  staffLines: number[]; // 5 y values, top to bottom, equally spaced
  staffLeft: number;
  staffRight: number; // the final barline's x
  clefX: number;
  timeSignatureX: number;
  slotX: number[]; // 8 equally spaced slot centres
  beatX: number[]; // 4 values: slotX[0], slotX[2], slotX[4], slotX[6]
  noteheads: NoteheadGlyph[];
  stems: StemGlyph[]; // one per non-empty slot
  beams: BeamGlyph[]; // one per beat whose two slots both have notes
  flags: FlagGlyph[]; // one per non-empty slot whose beat partner is empty
  rests: RestGlyph[];
  comments: TextGlyph[]; // one per slot with a non-empty comment
  counts: TextGlyph[]; // 8: "1", "&", "2", "&", "3", "&", "4", "&"
};

export function layoutSignatureV1(signature: SignatureV1): NotationLayout;
```

Staff positions (spec §7.1): `hihat-closed` in the space above the top line (`staffLines[0] − gap/2`), `snare` in the third space from the bottom (between `staffLines[1]` and `staffLines[2]`), `kick` in the bottom space (between `staffLines[3]` and `staffLines[4]`). Comments sit above every stem top and beam. Counts sit below the bottom line. Exact numbers are the builder's (spec §12); the brainstorming mockup used a 560 × 150 space, slot step 52, and line gap 10.

- [ ] **Step 1: Write the failing tests** (build signatures with a small `grid("HK H HS …")` helper in the test, same notation as spec §5.1):
  - **money beat** `HK H HS H HK H HS H`: 12 noteheads (8 `x` hi-hat, 2 kick, 2 snare), 8 stems, 4 beams, 0 flags, 0 rests;
  - **geometry**: `slotX` has 8 values with one constant step; `beatX` equals `[slotX[0], slotX[2], slotX[4], slotX[6]]`; `staffLines` has 5 equal gaps; hi-hat `y < staffLines[0]`; snare `staffLines[1] < y < staffLines[2]`; kick `staffLines[3] < y < staffLines[4]`; every glyph `x` lies within `[0, width]`;
  - **one empty slot in a beat** `S - S S S S S S`: beat 1 gives one flag at slot 0's stem and one `eighth` rest at `slotX[1]`; no beam for beat 1, beams for beats 2–4;
  - **fully empty beat** `- - S S S S S S`: one `quarter` rest at `beatX[0]`, no eighth rests, no flag;
  - **empty signature**: 4 quarter rests at `beatX`, no noteheads, stems, beams or flags;
  - **three instruments** `HSK` in slot 0: 3 noteheads at the same `x`; its stem has `yBottom` ≥ the kick notehead's `y` and `yTop` < the hi-hat notehead's `y`;
  - **comments**: Single strokes `S(R) S(L) …` gives 8 comments with texts `R L R L R L R L`, each with `y` smaller than every beam `y` and every stem `yTop`; a comment on a rest slot (`-(R) S …`) is present at that slot's `x`;
  - **counts**: 8 texts `1 & 2 & 3 & 4 &` at `slotX`, each `y` greater than `staffLines[4]`.
- [ ] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/web test -- notation-layout`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement** `layoutSignatureV1` in `notation-layout.ts`. Geometry constants live at the top of the file. A stem runs from just below its lowest notehead (or at it) up to one shared stem-top `y` for the whole bar, so beams are horizontal.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Checkpoint.** `pnpm format`. Files: the two above.

### Task 2: Count-in number and current beat

**Files:**

- Modify: `apps/web/src/features/practice/click-schedule.ts`
- Test: `apps/web/src/features/practice/click-schedule.test.ts`

**Interfaces:**

- Consumes: the existing `ClickPlan`, `COUNT_IN_BEATS`.
- Produces:
  - `countInNumber(plan: ClickPlan, now: number): number`: `4 − i` where `i` is the index of the latest count-in click with `time ≤ now`, `0` before the first click. The result is always 1–4.
  - `currentBeat(plan: ClickPlan, now: number): number | null`: `null` when `now < exerciseStart` or `now ≥ end`; otherwise `floor((now − exerciseStart) / beatSeconds) mod 4` (0 = beat 1), computed with the same `1e-9` tolerance as `clicksInWindow`, so a frame exactly on a click shows the new beat.

- [ ] **Step 1: Write the failing tests** with `planClicks({ startTime: 10, tempoBpm: 120, durationSeconds: 30 })` (beat 0.5 s, count-in clicks at 10, 10.5, 11, 11.5, exerciseStart 12, end 42):
  - `countInNumber` at 9.9 → 4, at 10 → 4, at 10.49 → 4, at 10.5 → 3, at 11 → 2, at 11.5 → 1, at 11.99 → 1, at 12.3 → 1 (clamped, never 0);
  - `currentBeat` at 11.99 → `null`, at 12 → 0, at 12.49 → 0, at 12.5 → 1, at 13.5 → 3, at 14 → 0 (next bar), at 41.99 → 3, at 42 → `null`, at 50 → `null`;
  - a click time accumulated by float steps (`12 + 0.5 * 3`, computed as `exerciseStart + k * beatSeconds`) → beat 3, not 2;
  - end mid-bar: `planClicks({ startTime: 0, tempoBpm: 70, durationSeconds: 30 })` → `currentBeat(plan, plan.end - 1e-6)` is a number and `currentBeat(plan, plan.end)` is `null`.
- [ ] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/web test -- click-schedule`. Expected: FAIL (functions missing).
- [ ] **Step 3: Implement** both functions in `click-schedule.ts`.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Checkpoint.** `pnpm format`. Files: the two above.

### Task 3: Notation component, lesson page and visual beat

**Files:**

- Create: `apps/web/src/features/signature/signature-notation.tsx`
- Modify: `apps/web/src/features/practice/practice-panel.tsx`, `apps/web/src/features/lessons/lesson-details.tsx`
- Modify (docs): `.claude/skills/local-dev/SKILL.md` (Library flows 11 and 13, Practice flows 2), this plan, `docs/adr/0040-practice-player-without-signature.md` and `docs/adr/README.md` (status `repaid in ADR-0054`), `docs/specs/README.md`

**Interfaces:**

- Consumes: Task 1 `layoutSignatureV1`, `NotationLayout`; Task 2 `countInNumber`, `currentBeat`; `Signature` from contracts.
- Produces (plan 03 relies on these):

```ts
export type NotationVisual =
  | { kind: "static" }
  | { kind: "count-in"; number: number } // 1–4
  | { kind: "playing"; beat: number | null };

export function SignatureNotation(props: {
  signature: Signature;
  visual?: NotationVisual; // default { kind: "static" }
  className?: string;
}): JSX.Element;
```

- [ ] **Step 1: Build `SignatureNotation`.** It switches on `signature.version` (only `"v1"`; the `switch` is exhaustive, so a future version fails typecheck until it has a branch). It draws `layoutSignatureV1(signature)` into `<svg viewBox="0 0 {width} {height}" className="w-full h-auto" role="img" aria-label="Drum notation: one bar of 4/4">`:
  - five staff lines, the percussion clef (two short thick bars), `4` over `4`, the final barline;
  - x noteheads as two crossing lines and filled noteheads as tilted ellipses;
  - stems, beams, flags, eighth and quarter rests (simple hand-drawn paths), comments (semibold) and counts (small, muted).
  - Visuals:
    - `count-in`: the SVG gets `opacity-35 grayscale`. A centred overlay `<div>` holds the number in a large bold font on a `bg-background/80` plate with rounded corners and a soft shadow. It has `data-testid="count-in-number"`.
    - `playing` with a beat: a soft band behind the staff plus a vertical line at `beatX[beat]`, both in `text-primary`. The SVG gets `data-beat={beat + 1}`.
  - The wrapper is `relative` so the overlay can sit on top.
- [ ] **Step 2: Wire the visual into `PracticePanel`.**
  - Add state `countIn: number` and `beat: number | null`, both primitives. In the existing animation-frame `refresh`, set them from `countInNumber(plan, now)` and `currentBeat(plan, now)`. Reset to `4` / `null` in `start()` and whenever the panel leaves `count-in` / `playing`.
  - Derive `visual`: `count-in` status → `{ kind: "count-in", number: countIn }`; `playing` → `{ kind: "playing", beat }`; any other status → `{ kind: "static" }`.
  - Render the notation card (shadcn `Card` or a bordered `div` matching the old box's radius) as the first child of the panel's `<section>`. That keeps it above the controls in every state.
- [ ] **Step 3: Update `LessonDetails`.** Remove the "Sheet coming soon" box. The practice panel now renders the notation above its controls. Keep the loading skeleton's `h-40` block, which stands for the notation.
- [ ] **Step 4: Run** `scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm typecheck --force && scripts/with-node.sh pnpm test`. Expected: all PASS.
- [ ] **Step 5: Verify in the browser** (`local-dev` skill, Playwright plugin, after `db:seed`, fresh email). Install the click recorder from the skill's Practice flows.
  - **Static notation:** "Money beat" shows 8 x noteheads above the staff, kicks on 1 and 3, snares on 2 and 4, four beams, counts below. "Single strokes on a pad" shows `R L R L R L R L` above the notes. "Quarter-note kick control" shows kicks with flags and eighth rests. "Offbeat snare reading" shows rests on the beats. No "Sheet coming soon" anywhere. Take one screenshot per lesson as evidence.
  - **Count-in:** at 60 BPM, Start → the notation is greyed and `count-in-number` reads `4`, `3`, `2`, `1` in step with the 4 recorded count-in clicks (sample the text with `browser_evaluate` every 100 ms and compare against `__clicks[i].when` mapped through the page's `AudioContext.currentTime`).
  - **Playing:** after the count-in, the SVG's `data-beat` goes `1, 2, 3, 4, 1, …`, changing within one frame of each recorded exercise click. Stop → no `data-beat`, no overlay, notation not greyed.
  - **End mid-bar:** a 0:30 session at 70 BPM ends with the notation static, and no highlight after `Completed`.
  - **Review Focus 3:** with a temporary render counter (`console.count` in `SignatureNotation`), 10 s of play at 120 BPM produce about 20 renders, not about 600. Remove the counter.
  - **Review Focus 5:** at a 375 px wide viewport the notation fits the column with no horizontal scroll. In dark mode (`browser_emulate_media` `colorScheme: "dark"`) staff and notes are light on dark.
- [ ] **Step 6: Update docs.**
  - In the `local-dev` skill: Library flow 11 shows the notation instead of "Sheet coming soon" and a working Start. Flow 13 no longer forbids notation, only rating. Practice flow 2 describes the greyed count-in with `4 3 2 1` and the `data-beat` highlight. Add the checks from Step 5 as a short "Notation" list.
  - Set ADR-0040 and its index row to `repaid in ADR-0054` (spec §10 and its changelog).
- [ ] **Step 7: Checkpoint.** `pnpm format`. Tick this plan's checkboxes, set its status to `done`, update the signature row in `docs/specs/README.md`. Files: the files of this task.

## Execution notes

<!-- Filled in during execution: any decision taken while building. -->

# Practice and Stats — Plan 02: Player UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
- **Status:** done

**Goal:** Spec §6.2: the practice panel on `/lessons/$lessonId`. The drummer sets tempo and duration, hears a 4-click count-in and a quarter-note metronome on the Web Audio clock, and sees a countdown. Stop, a hidden page or leaving logs nothing. Completion saves one practice log, retried without duplicates while the page is open.

**Architecture:** Everything with a rule in it is a pure module with unit tests: the click schedule, the countdown, the panel's state machine (a reducer), the retry policy and the local date. The `Metronome` class is a thin Web Audio wrapper driven by the schedule (ADR-0016). `PracticePanel` wires the reducer, the metronome, the save mutation and the page-level listeners (visibility, unload, router blocker). Audio and listeners are verified in the browser with the Playwright plugin, since the web app has no component-test setup (ADR-0027).

**Tech Stack:** React 19, TanStack Router (`useBlocker`) / Query / Form, Web Audio API, shadcn/ui, Vitest 5 (node environment, pure functions only). No new dependencies.

**Spec:** [spec.md](spec.md) · **Depends on:** [plan-01-backend.md](plan-01-backend.md) done. Independent of [plan-03-stats-ui.md](plan-03-stats-ui.md).

## Global Constraints

- [spec.md](spec.md) wins over this plan if they disagree. Raise the conflict instead of picking one silently.
- **Git:** commit only when the user explicitly asks (their global rule). Each task ends with a checkpoint; if the user has asked for per-task commits, commit that task's files to `main` with a short imperative message and no AI attribution. Never branch, push, stash, rebase or reset.
- Run every `pnpm` command through `scripts/with-node.sh`.
- No new npm dependencies. Stock shadcn/ui components already in `src/components/ui`.
- No visual beat indicator of any kind: no dots, no flashing, no beat numbers (ADR-0040). The metronome is sound only. "Sheet coming soon" stays.
- Clicks and the end of the exercise are timed on `AudioContext.currentTime`, never with `setInterval` counters or `Date.now()` (ADR-0016). A JS timer may only drive the look-ahead loop and the display refresh.
- No screen wake lock and no mobile-specific behaviour (ADR-0047). No local persistence of an unsaved log (ADR-0045).
- Nothing about the session goes to the API except the one `POST /api/practice-logs` at completion and its retries.
- Stats query keys live under the root `["stats"]` (plan 03 defines `statsKeys.all = ["stats"]`); a saved log invalidates that root.
- Run `scripts/with-node.sh pnpm format` before closing each task.
- Any shortcut or `TODO` needs a tech-debt ADR, and the comment must read `// TODO(ADR-NNNN): …`.

**Exact copy** (spec §6.2):

| Where                        | Text                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------- |
| setup button                 | `Start`                                                                       |
| count-in label               | `Count-in`                                                                    |
| stop button                  | `Stop`                                                                        |
| tempo shown while running    | `{bpm} BPM`                                                                   |
| saving                       | `Completed` + `Saving your session…`                                          |
| saved                        | `Completed — {m:ss} at {bpm} BPM logged.` + button `Practice again`           |
| save failed (retryable)      | `Completed, but your session isn't saved yet. Retrying…` + button `Retry now` |
| save rejected                | `Your session couldn't be saved: {reason}` + button `Practice again`          |
| rejected reason for `404`    | `This lesson is no longer available.`                                         |
| note after an automatic stop | `Session stopped because the app was in the background. Nothing was logged.`  |
| leave dialog                 | title `Your session isn't saved yet. Leave anyway?`, buttons `Stay` / `Leave` |

## Review Focus

1. **Audio after leaving.** Navigating away during play, to another lesson (`/lessons/A` → `/lessons/B`) or to the library, must silence the clicks at once and close the `AudioContext`. React StrictMode mounts effects twice in dev, so cleanup must be idempotent and must not stop a session that is still on screen. Checked in Task 5 (click recorder stops growing after navigation).
2. **Double Start.** A double-click on Start must create one `AudioContext` and one schedule, not two overlapping metronomes. Handled in Task 4 (Start disabled once `count-in` begins, `Metronome.start` refuses while running), checked in Task 5.
3. **Hidden page while saving.** Switching tabs during `saving` or `save-failed` must not cancel the save. Only `count-in` and `playing` stop on hide. Unit-tested in Task 2 (reducer ignores `stop` outside running states), checked in Task 5.
4. **Retries after leaving.** After the user confirms "Leave", or after an unmount, no retry timer or request may keep firing. Checked in Task 5 (network list after leaving).
5. **401 during save.** A lost session must redirect to `/login` without the leave dialog getting in the way. The blocker ignores navigation to `/login`. Checked in Task 5.

---

### Task 1: Local date, click schedule, countdown and retry policy

**Files:**
- Create: `apps/web/src/lib/local-date.ts` (skip if plan 03 already created it with the same interface), `apps/web/src/features/practice/click-schedule.ts`, `apps/web/src/features/practice/save-policy.ts`
- Test: `apps/web/src/lib/local-date.test.ts`, `apps/web/src/features/practice/click-schedule.test.ts`, `apps/web/src/features/practice/save-policy.test.ts`

**Interfaces:**
- Produces:
  - `local-date.ts`: `toLocalDate(date: Date): LocalDate` (the browser's local calendar date, `YYYY-MM-DD`, from `getFullYear/getMonth/getDate`); `todayLocal(): LocalDate` = `toLocalDate(new Date())`.
  - `click-schedule.ts`:
    - `COUNT_IN_BEATS = 4`.
    - `type ClickPlan = { startTime: number; beatSeconds: number; exerciseStart: number; end: number; durationSeconds: number }` (seconds on the audio clock).
    - `planClicks(args: { startTime: number; tempoBpm: number; durationSeconds: number }): ClickPlan`: `beatSeconds = 60 / tempoBpm`, `exerciseStart = startTime + 4 * beatSeconds`, `end = exerciseStart + durationSeconds`.
    - `type Click = { time: number; accent: boolean; countIn: boolean }`.
    - `clicksInWindow(plan: ClickPlan, from: number, to: number): Click[]`: all clicks with `from <= time < to` and `time < plan.end`, ascending. Count-in clicks are `startTime + i * beat` for `i` 0–3, the first one accented. Exercise clicks are `exerciseStart + k * beat` for `k ≥ 0`, accented when `k % 4 === 0`. Compute times from indexes (no accumulated additions), so there is no float drift.
    - `remainingSeconds(plan: ClickPlan, now: number): number`: `plan.durationSeconds` until `exerciseStart`, then `ceil(end - now)` clamped to `[0, durationSeconds]`.
  - `save-policy.ts`:
    - `retryDelayMs(failures: number): number`: `min(1000 * 2 ** (failures - 1), 30_000)` for `failures ≥ 1`.
    - `classifySaveError(error: unknown): { kind: "retry" } | { kind: "reject"; reason: string } | { kind: "unauthenticated" }`: `ApiClientError` with status `0`, `≥ 500` or code `UNKNOWN`, and any non-`ApiClientError`, means retry; `401` means unauthenticated; `404` means reject with `This lesson is no longer available.`; any other `4xx` means reject with the error's `message`.

- [x] **Step 1: Write the failing tests**

```ts
// local-date.test.ts — dates built with local constructors, so the test holds in any TZ
expect(toLocalDate(new Date(2026, 9, 25, 23, 30))).toBe("2026-10-25");
expect(toLocalDate(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");

// click-schedule.test.ts — plan = planClicks({ startTime: 10, tempoBpm: 120, durationSeconds: 30 })
expect(plan).toMatchObject({ beatSeconds: 0.5, exerciseStart: 12, end: 42 });
expect(clicksInWindow(plan, 10, 13)).toEqual([
  { time: 10, accent: true, countIn: true },
  { time: 10.5, accent: false, countIn: true },
  { time: 11, accent: false, countIn: true },
  { time: 11.5, accent: false, countIn: true },
  { time: 12, accent: true, countIn: false },
  { time: 12.5, accent: false, countIn: false },
]);
expect(clicksInWindow(plan, 13.9, 14.1).map((c) => c.accent)).toEqual([true]); // 14 = beat 1 of bar 2
expect(clicksInWindow(plan, 41, 50).map((c) => c.time)).toEqual([41, 41.5]); // nothing at or after end
// 90 BPM, 30 s: exercise clicks k = 0..44, the last below end, none equal to end
const slow = planClicks({ startTime: 0, tempoBpm: 90, durationSeconds: 30 });
expect(clicksInWindow(slow, slow.exerciseStart, 1e9)).toHaveLength(45);
expect(remainingSeconds(plan, 11)).toBe(30); // during count-in
expect(remainingSeconds(plan, 12.2)).toBe(30);
expect(remainingSeconds(plan, 41.5)).toBe(1);
expect(remainingSeconds(plan, 43)).toBe(0);

// save-policy.test.ts
expect([1, 2, 3, 4, 5, 6, 7].map(retryDelayMs)).toEqual([
  1000, 2000, 4000, 8000, 16000, 30000, 30000,
]);
expect(classifySaveError(new ApiClientError(0, "NETWORK_ERROR", "x"))).toEqual({ kind: "retry" });
expect(classifySaveError(new ApiClientError(503, "SERVICE_UNAVAILABLE", "x"))).toEqual({
  kind: "retry",
});
expect(classifySaveError(new ApiClientError(502, "UNKNOWN", "x"))).toEqual({ kind: "retry" });
expect(classifySaveError(new TypeError("x"))).toEqual({ kind: "retry" });
expect(classifySaveError(new ApiClientError(401, "UNAUTHENTICATED", "x"))).toEqual({
  kind: "unauthenticated",
});
expect(classifySaveError(new ApiClientError(404, "NOT_FOUND", "Lesson not found"))).toEqual({
  kind: "reject",
  reason: "This lesson is no longer available.",
});
expect(classifySaveError(new ApiClientError(400, "VALIDATION_ERROR", "Invalid request"))).toEqual({
  kind: "reject",
  reason: "Invalid request",
});
```

- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/web test`. Expected: FAIL, modules missing.
- [x] **Step 3: Implement the three modules** listed under Interfaces.
- [x] **Step 4: Run** the web tests. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Commit if the user asked for per-task commits.

### Task 2: Practice state machine

**Files:**
- Create: `apps/web/src/features/practice/practice-machine.ts`
- Test: `apps/web/src/features/practice/practice-machine.test.ts`

**Interfaces:**
- Consumes: `PracticeLogInput`, `PracticeLog` from `@drum-tutor/contracts`.
- Produces:

```ts
type PracticeSettings = { tempoBpm: number; durationSeconds: number };
type PracticeState =
  | { status: "setup"; settings: PracticeSettings; stoppedInBackground: boolean }
  | { status: "count-in"; settings: PracticeSettings }
  | { status: "playing"; settings: PracticeSettings }
  | { status: "saving"; settings: PracticeSettings; log: PracticeLogInput; failures: number }
  | { status: "save-failed"; settings: PracticeSettings; log: PracticeLogInput; failures: number }
  | { status: "saved"; settings: PracticeSettings; log: PracticeLog }
  | { status: "save-rejected"; settings: PracticeSettings; reason: string };
type PracticeEvent =
  | { type: "start"; settings: PracticeSettings }
  | { type: "count-in-done" }
  | { type: "stop"; cause: "user" | "background" }
  | { type: "complete"; log: PracticeLogInput }
  | { type: "save-succeeded"; log: PracticeLog }
  | { type: "save-failed" }
  | { type: "retry" }
  | { type: "save-rejected"; reason: string }
  | { type: "practice-again" };
initialPracticeState(settings: PracticeSettings): PracticeState  // setup, stoppedInBackground false
practiceReducer(state: PracticeState, event: PracticeEvent): PracticeState
isRunning(state): boolean   // count-in | playing
isUnsaved(state): boolean   // saving | save-failed
```

Transitions (every other pair returns `state` unchanged, by reference):
- `setup` + `start` → `count-in` with the event's settings;
- `count-in` + `count-in-done` → `playing`;
- `count-in` | `playing` + `stop` → `setup`, same settings, `stoppedInBackground = cause === "background"`;
- `playing` + `complete` → `saving` with the log, `failures: 0`;
- `saving` + `save-succeeded` → `saved`; `saving` + `save-failed` → `save-failed` with `failures + 1`; `saving` + `save-rejected` → `save-rejected`;
- `save-failed` + `retry` → `saving` (same log and failures);
- `saved` | `save-rejected` + `practice-again` → `setup`, same settings, `stoppedInBackground: false`.

* [x] **Step 1: Write the failing tests:** the full happy path setup → count-in → playing → saving → saved → practice-again keeps settings; `stop` with cause `background` sets `stoppedInBackground`, `user` clears it; `stop` in `saving`, `save-failed`, `saved` and `setup` returns the same object (Review Focus 3); `complete` in `count-in` is ignored (only `playing` completes); two `save-failed` + `retry` cycles keep the same `log` (same `idempotencyKey`) and count `failures` 1, 2; `start` while `count-in` is ignored (Review Focus 2); `isRunning` / `isUnsaved` for every status.
* [x] **Step 2: Run** the web tests. Expected: FAIL.
* [x] **Step 3: Implement** `practice-machine.ts` as a `switch` on `state.status` with the event checked inside.
* [x] **Step 4: Run** the web tests. Expected: PASS.
* [x] **Step 5: Checkpoint.** `pnpm format`. Commit if the user asked for per-task commits.

### Task 3: Metronome on Web Audio

**Files:**
- Create: `apps/web/src/features/practice/metronome.ts`

**Interfaces:**
- Consumes: Task 1 `planClicks`, `clicksInWindow`, `ClickPlan`.
- Produces:

```ts
type MetronomeCallbacks = {
  onCountInDone: () => void;
  onComplete: () => void;
  onInterrupted: () => void; // the AudioContext left "running" without stop() being called
};
class Metronome {
  constructor(callbacks: MetronomeCallbacks);
  start(settings: PracticeSettings): Promise<void>; // throws if already running
  stop(): void;                                     // idempotent; silences at once
  get plan(): ClickPlan | null;
  now(): number;                                    // audioContext.currentTime, 0 when stopped
}
```

Behaviour:
- `start` creates a new `AudioContext` and awaits `resume()`. It must be called synchronously from the click handler (user gesture). Then `planClicks({ startTime: ctx.currentTime + 0.1, … })`.
- The scheduler loop runs every 25 ms (`setInterval`) and schedules `clicksInWindow(plan, scheduledUntil, ctx.currentTime + 0.1)`. Each click is a short oscillator burst: about 30 ms, gain envelope to 0, 1500 Hz for an accent and 1000 Hz otherwise. It calls `onCountInDone` once when `currentTime ≥ exerciseStart` and `onComplete` once when `currentTime ≥ end`, then stops itself.
- `stop()` sets an `intentional` flag first, clears the loop, disconnects scheduled nodes and `close()`s the context. A `statechange` to anything but `running` without that flag calls `onInterrupted` (spec §6.2, ADR-0044).
- No React in this file.

* [x] **Step 1: Implement** `metronome.ts`. There is no unit test: the timing rules are tested in Task 1, and the audio wiring is checked in the browser in Task 5 with a click recorder.
* [x] **Step 2: Run** `scripts/with-node.sh pnpm typecheck` and `pnpm lint`. Expected: PASS.
* [x] **Step 3: Checkpoint.** `pnpm format`. Commit if the user asked for per-task commits.

### Task 4: Practice panel on the lesson page

**Files:**
- Create: `apps/web/src/features/practice/practice-logs.api.ts`, `apps/web/src/features/practice/practice-panel.tsx`, `apps/web/src/features/practice/leave-guard.tsx`
- Modify: `apps/web/src/features/lessons/lesson-details.tsx` (replace the disabled Start with `<PracticePanel lesson={data} />`), `apps/web/src/routes/_authenticated/_app/lessons/$lessonId.tsx` (`<LessonDetails key={lessonId} …>`, so another lesson mounts a fresh panel)

**Interfaces:**
- Consumes: Tasks 1–3; `TempoField`, `DurationField` from `features/admin-lessons` (bound to TanStack Form, reused as is); `TempoBpmSchema`, `DurationSecondsSchema`, `PracticeLogSchema`, `ApiPaths.practiceLogs`; `formatDuration`.
- Produces:
  - `practice-logs.api.ts`: `useSavePracticeLog()` = `useMutation({ mutationFn: (input: PracticeLogInput) => apiRequest(ApiPaths.practiceLogs, { method: "POST", body: input, schema: PracticeLogSchema }), meta: { suppressErrorToast: true }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stats"] }) })`. A `401` still redirects through the global handler, which runs before `suppressErrorToast`.
  - `PracticePanel({ lesson }: { lesson: LessonDetail })`.
  - `LeaveGuard({ when }: { when: boolean })`: `useBlocker({ shouldBlockFn: ({ next }) => when && next.pathname !== "/login", enableBeforeUnload: () => when, withResolver: true })` rendered as an AlertDialog with the exact copy. `Stay` calls `reset`, `Leave` calls `proceed`.

- [x] **Step 1: Build the panel.**
  - A TanStack Form with `tempoBpm` / `durationSeconds` defaults from the lesson and validators `TempoBpmSchema` / `DurationSecondsSchema`, following `lesson-form.tsx`. `TempoField` and `DurationField` render it. **Start** is the submit, disabled while the form is invalid or the state is not `setup`.
  - The state comes from `useReducer(practiceReducer, settings, initialPracticeState)`. One `Metronome` per panel lives in a ref, with callbacks that dispatch `count-in-done`, `complete` (see below) and `stop` with cause `background`.
  - The submit handler runs synchronously in the click: `dispatch({ type: "start" })`, then `metronome.start(values)`. If `start` rejects (audio unavailable), dispatch `stop` with cause `user` and show `toast.error("Audio could not start")`.
  - On complete, build the `PracticeLogInput`: `idempotencyKey: crypto.randomUUID()`, `lessonId`, settings, `completedAt: new Date().toISOString()`, `localDate: todayLocal()`. Then dispatch `complete`.
  - **While running:** a `visibilitychange` (hidden) and a `pagehide` listener stop the metronome and dispatch `stop` with cause `background`. A `requestAnimationFrame` loop reads `remainingSeconds(metronome.plan, metronome.now())` and sets display state only when the shown second changes. The effect cleanup removes the listeners and cancels the frame.
  - **Unmount cleanup:** `metronome.stop()` (Review Focus 1).
  - **Saving:** an effect on `status === "saving"` calls `mutateAsync(state.log)`. Success dispatches `save-succeeded`. An error goes through `classifySaveError`: `retry` dispatches `save-failed`, `reject` dispatches `save-rejected`, and `unauthenticated` does nothing (the global handler redirects). A ref of the last sent `(idempotencyKey, failures)` keeps StrictMode's double effect from sending twice.
  - **Retry timer:** an effect on `status === "save-failed"` sets `setTimeout(retryDelayMs(failures))` that dispatches `retry`, and clears it in cleanup (Review Focus 4). **Retry now** dispatches `retry`.
  - Rendering follows the spec §6.2 state table and the exact copy. The panel never renders a beat indicator.
  - `<LeaveGuard when={isUnsaved(state)} />`.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm typecheck && scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm --filter @drum-tutor/web test`. Expected: PASS.
- [x] **Step 3: Smoke check** with the app running (`scripts/dev-start.sh`, seeded): open a lesson, Start, hear the count-in, Stop. Expect no console errors.
- [x] **Step 4: Checkpoint.** `pnpm format`. Commit if the user asked for per-task commits.

### Task 5: Browser verification and the local-dev skill

**Files:**
- Modify: `.claude/skills/local-dev/SKILL.md` (new "Practice flows (e2e)" section)
- Modify: this plan (ticks, status, execution notes)

- [x] **Step 1: Prepare.** `scripts/dev-start.sh`, `scripts/with-node.sh pnpm db:seed`, log in with a fresh email. Install a click recorder before the page scripts run (`browser_run_code_unsafe` → `page.addInitScript`). It wraps `OscillatorNode.prototype.start` to push `{ when, frequency }` into `window.__clicks` and counts `AudioContext` constructions in `window.__contexts`.
- [x] **Step 2: Run each flow and compare with the expected result:**
  1. **Defaults.** Open a published lesson. The tempo and duration equal the lesson's recommendation. The duration buttons stop at 00:30 and 60:00. Tempo `320` shows the tempo error and disables Start.
  2. **Count-in and click timing.** Set 120 BPM, Start. Within 3 s `__clicks` holds 4 count-in clicks 0.5 s apart, the first at the accent frequency, then exercise clicks 0.5 s apart with the accent on every 4th. During count-in the panel shows `Count-in` and the full duration. There is no beat indicator in the DOM.
  3. **Stop.** Stop during play. The panel is back in setup, `__clicks` stops growing, and `browser_network_requests` shows no `POST /api/practice-logs`.
  4. **Double Start** (Review Focus 2). Double-click Start. `__contexts` grows by exactly 1. Stop.
  5. **Completion.** Set 0:30, Start, wait about 33 s. Expect `Completed — 0:30 at {bpm} BPM logged.`, exactly one `POST` with `201`, and the log visible in `GET /api/stats/daily` for one of the lesson's tags today. **Practice again** returns to setup with the same values.
  6. **Hidden page** (US-11a). During play, run `Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange"))`. Expect setup with the background note, clicks stopped and no `POST`. Reset the property.
  7. **Reload during play.** Reload the page while playing. Expect no `POST` and setup after the reload.
  8. **Leaving during play** (Review Focus 1). Start, then click "Back to library". Then start on lesson A and navigate to lesson B's URL. `__clicks` stops growing at once in both cases, and B shows setup.
  9. **Save failure and retry** (US-11b). `page.route('**/api/practice-logs', r => r.abort())` before a 30 s session completes. Expect the retry state with `Retry now` and repeated attempts at about 1 s, 2 s and 4 s. While it retries, hide the page (as in flow 6): the save state stays (Review Focus 3). Click "Back to library": the leave dialog appears, and `Stay` keeps the page. Then `page.unroute` and click `Retry now`. Expect `201`, the saved message, and exactly one new row (`select count(*) from practice_logs where idempotency_key = …` via `docker compose exec postgres psql -U drum -d drum_tutor`, or the stats total).
  10. **Leave while unsaved** (Review Focus 4). Repeat the failure, then click `Leave`. Expect navigation and no further `POST` attempts in the next 10 s.
  11. **Rejected save.** Abort-route once to reach the retry state, then move the lesson to draft with psql (`update lessons set status = 'draft' where id = …`), unroute and Retry now. Expect `404` and `Your session couldn't be saved: This lesson is no longer available.` Restore the lesson to published.
  12. **401 while saving** (Review Focus 5). In the retry state, delete the session (clear cookies through `page.context().clearCookies()`), unroute and Retry now. Expect a redirect to `/login` with no leave dialog.
- [x] **Step 3: Update the local-dev skill** with a "Practice flows (e2e)" section: the click recorder snippet and flows 1–12, in the style of the existing sections.
- [x] **Step 4: Run** `scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm typecheck && scripts/with-node.sh pnpm test`. Expected: PASS.
- [x] **Step 5: Checkpoint.** `pnpm format`. Tick this plan's checkboxes, set its status to `done` and update the plan status in `docs/specs/README.md`. Commit if the user asked.

## Execution notes

<!-- Filled in during execution: decisions taken while building and browser-check observations. -->

- **Commits.** No per-task commits; the user commits on request (global rule).
- **Task 1.** `ClickPlan` also carries `tempoBpm`. The end check is `k * 60 < durationSeconds * tempoBpm` in integers, because `30 / (60 / 90)` is `45.00000000000001` in floating point and would add a click at the end.
- **Task 4.** Start is a plain button that validates the tempo synchronously and starts the metronome inside the click handler, not a form submit. TanStack Form's `handleSubmit` is async, so the `AudioContext` would be created outside the user gesture, which Safari refuses to play. The form only holds the two fields.
- **Task 5 (browser, Chromium through the Playwright plugin, 2026-10-25).** All 12 flows behaved as expected:
  - At 120 BPM the clicks were 0.5 s apart, accented at 0 and 2 s. A 0:30 session scheduled 64 clicks (4 + 60) and one `POST` (201).
  - A double Start created one `AudioContext`.
  - Retries came 1, 2 and 4 s apart, and hiding the page kept the retry state.
  - After the network came back, exactly one log was added (+30 s for the tag).
  - Leaving stopped all further attempts.
  - A draft lesson gave a 404 rejection, and a lost session redirected to `/login` without the dialog.
  - The console showed only the expected aborted, 404 and 401 resource errors.
- **Final review (Opus) fixes:**
  - The save mutation uses `networkMode: "always"`. With TanStack Query's default `"online"`, a real offline drop paused the mutation: the panel stayed on "Saving…" and the paused log was still sent after "Leave" once the network returned (ADR-0045). Test: `practice-logs.api.test.ts`. Browser: `setOffline(true)` gives the retry state, and after Leave plus going online there is no `POST`.
  - `Metronome.start` resolves quietly when `stop()` closes the context while `resume()` is pending, and ignores a second start instead of throwing. Before this, Start then Stop showed a false "Audio could not start" toast, and the failure could stop a newer session. Test: `metronome.test.ts`. Browser: Start/Stop ×3 gives no toast.
- **Browser artifacts, not bugs.** Navigating while offline to a route chunk that was never loaded fails in dev (code splitting), and the router's reload attempt then meets the `beforeunload` guard. Load the library first before the offline flow.

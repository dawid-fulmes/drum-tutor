# Signature — Plan 01: Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Status:** done

**Goal:** Everything server-side for spec §4, §5, §6 and the API part of §8: the signature contract (v1 schema and helpers), the `lessons.signature` migration, signature read/write in the lesson endpoints, the `SIGNATURE_EMPTY` publish rule, the rebuilt seed, and the tests that prove each rule.

**Architecture:** `packages/contracts` gets `signature.ts` with a Zod discriminated union on `version`; `LessonInput`, `LessonDetail` and `AdminLesson` carry it. `packages/db` gets a `jsonb` column with a local structural type (it must not import contracts, `schema.ts:23`) and a hand-edited migration that backfills the empty v1 value. `apps/api` writes the parsed body as is and parses the stored JSON with `SignatureSchema` on every read. Publish and update check `signatureHasNotes` under the existing `FOR UPDATE` row lock. The web app only gets the two lines it needs to keep compiling; the editor and renderer are plans 02 and 03.

**Tech Stack:** Zod 4, Fastify 5 + fastify-type-provider-zod, Drizzle 0.45 + node-postgres, Vitest + Testcontainers. No new dependencies.

**Spec:** [spec.md](spec.md)

## Global Constraints

- [spec.md](spec.md) wins over this plan if they disagree. Raise the conflict instead of picking one silently.
- **Git:** never commit, branch, push, stash, rebase or reset unless the user explicitly asked for it in the current turn (user's global rule). Each task's "Checkpoint" lists the files that belong together, so the user can commit them per task when they choose. If asked to commit: to `main`, short imperative summary, no `Co-Authored-By` or AI attribution.
- Run every `pnpm` command through `scripts/with-node.sh` (e.g. `scripts/with-node.sh pnpm test`).
- No new npm dependencies.
- `packages/db` does not import `@drum-tutor/contracts` (spec §4.1 "Package boundary").
- Every error body follows ADR-0022. Domain errors are thrown as `AppError` from repositories.
- Code, test data and messages in English. Test emails use `@example.com`.
- Run `scripts/with-node.sh pnpm format` before closing each task.
- Any shortcut or `TODO` needs a tech-debt ADR, and the comment must read `// TODO(ADR-NNNN): …`.

**Exact copy**

| Where                              | Message                                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| `slots` not exactly 8              | `A signature has exactly 8 slots`                          |
| unknown instrument                 | `Unknown instrument`                                       |
| duplicate instrument in a slot     | `An instrument can only appear once in a slot`             |
| comment longer than 3 (after trim) | `A comment can be at most 3 characters`                    |
| `409 SIGNATURE_EMPTY`              | `Add at least one note to the signature before publishing` |

## Review Focus

1. **Lessons published before the migration.** They carry the backfilled empty signature. Publishing one again must be `409 SIGNATURE_EMPTY`, not the old idempotent `200`; unpublishing it still works. Tested in Task 3.
2. **Extra keys inside the signature** (`slots[0].accent: true`, a top-level `bpm`) are dropped by the schema and never reach the database. The stored JSON is exactly the contract shape. Tested in Task 2 by reading the row straight from the database.
3. **Whitespace comments.** `" R "` is stored as `"R"`, `"   "` as `""`, and `"RLRL"` is `400` with the detail path `signature.slots.N.comment`. Tested in Task 1 (schema) and Task 2 (API path).
4. **A locked published lesson PUT with an empty signature** returns `409 LESSON_LOCKED` (the lock wins) and changes nothing. Tested in Task 3.
5. **Publish racing a PUT that empties the signature.** Both take the row with `FOR UPDATE`, so whichever runs second sees the other's result. The end state is never "published with an empty signature". Tested in Task 3 with both requests fired together, asserting the invariant rather than an order.

---

### Task 1: Signature contract

**Files:**

- Create: `packages/contracts/src/signature.ts`
- Modify: `packages/contracts/src/lessons.ts`, `packages/contracts/src/api-error.ts`, `packages/contracts/src/index.ts`
- Modify (compile only): `apps/web/src/features/admin-lessons/lesson-form.tsx` (`NEW_LESSON_DEFAULTS`), `apps/web/src/routes/_authenticated/admin/lessons/$lessonId.edit.tsx` (`defaultValues`), plus any web test fixture that typecheck flags for a missing `signature`
- Test: `packages/contracts/src/signature.test.ts`, `packages/contracts/src/lessons.test.ts`

**Interfaces:**

- Produces (exported from `@drum-tutor/contracts`):
  - `INSTRUMENTS = ["hihat-closed", "snare", "kick"] as const`, `InstrumentSchema` (`z.enum(INSTRUMENTS, { error: "Unknown instrument" })`), `type Instrument`.
  - `SIGNATURE_V1_SLOTS = 8`, `SIGNATURE_COMMENT_MAX = 3`.
  - `SignatureSlotV1Schema = z.object({ instruments: z.array(InstrumentSchema).refine(unique, duplicate message), comment: z.string().trim().max(3, message) })`, `type SignatureSlotV1`.
  - `SignatureV1Schema = z.object({ version: z.literal("v1"), slots: z.array(SignatureSlotV1Schema).length(8, message) })`, `type SignatureV1`.
  - `SignatureSchema = z.discriminatedUnion("version", [SignatureV1Schema])`, `type Signature = z.infer<…>`.
  - `EMPTY_SIGNATURE_V1: SignatureV1` (8 × `{ instruments: [], comment: "" }`).
  - `signatureHasNotes(signature: Signature): boolean`.
  - `ApiErrorCode.SIGNATURE_EMPTY = "SIGNATURE_EMPTY"`.
  - `LessonInputSchema` gains `signature: SignatureSchema`; `LessonDetailSchema` gains `signature: SignatureSchema` (so `AdminLessonSchema` has it too). `LessonSummarySchema` and `AdminLessonSummarySchema` do not change.

- [x] **Step 1: Write the failing tests**

```ts
// signature.test.ts
const slot = (instruments: string[] = [], comment = "") => ({
  instruments,
  comment,
});
const sig = (slots: unknown[]) => ({ version: "v1", slots });
const money = sig([
  slot(["hihat-closed", "kick"]),
  slot(["hihat-closed"]),
  slot(["hihat-closed", "snare"]),
  slot(["hihat-closed"]),
  slot(["hihat-closed", "kick"]),
  slot(["hihat-closed"]),
  slot(["hihat-closed", "snare"]),
  slot(["hihat-closed"]),
]);
const firstIssue = (v: unknown) =>
  SignatureSchema.safeParse(v).error?.issues[0];

it("accepts a money beat and the empty signature", () => {
  expect(SignatureSchema.safeParse(money).success).toBe(true);
  expect(SignatureSchema.safeParse(EMPTY_SIGNATURE_V1).success).toBe(true);
});
it.each([7, 9])("rejects %i slots", (n) =>
  expect(
    firstIssue(sig(Array.from({ length: n }, () => slot())))?.message,
  ).toBe("A signature has exactly 8 slots"),
);
it("rejects an unknown instrument with only that message", () => {
  const issues = SignatureSchema.safeParse(
    sig([slot(["snare", "tom"]), ...Array(7).fill(slot())]),
  ).error?.issues;
  expect(issues?.map((i) => i.message)).toEqual(["Unknown instrument"]);
  expect(issues?.[0]?.path).toEqual(["slots", 0, "instruments", 1]);
});
it("rejects a duplicate instrument", () =>
  expect(
    firstIssue(sig([slot(["snare", "snare"]), ...Array(7).fill(slot())]))
      ?.message,
  ).toBe("An instrument can only appear once in a slot"));
it("trims comments and limits them to 3 characters", () => {
  const parsed = SignatureSchema.parse(
    sig([slot(["snare"], " R "), slot([], "   "), ...Array(6).fill(slot())]),
  );
  expect(parsed.slots[0]?.comment).toBe("R");
  expect(parsed.slots[1]?.comment).toBe("");
  expect(
    firstIssue(sig([slot([], "RLRL"), ...Array(7).fill(slot())])),
  ).toMatchObject({
    path: ["slots", 0, "comment"],
    message: "A comment can be at most 3 characters",
  });
});
it("rejects a missing or unknown version", () => {
  expect(SignatureSchema.safeParse({ slots: money.slots }).success).toBe(false);
  expect(SignatureSchema.safeParse({ ...money, version: "v2" }).success).toBe(
    false,
  );
});
it("drops unknown keys", () => {
  const parsed = SignatureSchema.parse({
    ...money,
    bpm: 90,
    slots: money.slots.map((s) => ({ ...s, accent: true })),
  });
  expect(parsed).toEqual(money);
});
it("tells whether a signature has notes", () => {
  expect(signatureHasNotes(EMPTY_SIGNATURE_V1)).toBe(false);
  expect(
    signatureHasNotes(
      SignatureSchema.parse(
        sig([slot(), slot(["kick"]), ...Array(6).fill(slot())]),
      ),
    ),
  ).toBe(true);
});

// lessons.test.ts — `base` gains `signature: EMPTY_SIGNATURE_V1`
it("requires a signature", () => {
  const { signature: _, ...withoutSignature } = base;
  expect(LessonInputSchema.safeParse(withoutSignature).success).toBe(false);
});
```

- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/contracts test`. Expected: FAIL, module `./signature` missing.
- [x] **Step 3: Implement** the Interfaces above in `signature.ts`, wire them into `lessons.ts`, `api-error.ts` and `index.ts`. The unique check compares `new Set(list).size === list.length`. If Zod 4 runs the array refinement after an item already failed and that produces a second issue, make the refinement skip input that already has issues (same lesson as the `LocalDate` note in `practice-and-stats/plan-01-backend.md`, Execution notes, Task 1).
- [x] **Step 4: Keep the web app compiling.** `NEW_LESSON_DEFAULTS` gets `signature: EMPTY_SIGNATURE_V1`. The edit route's `defaultValues` gets `signature: data.signature`, so saving an existing lesson sends its stored signature back unchanged until plan 03 adds the editor. Fix any web test fixture that typecheck flags by adding a `signature`.
- [x] **Step 5: Run** the contracts tests and `scripts/with-node.sh pnpm typecheck`. Expected: contracts PASS. Typecheck PASSES for `contracts` and `web`; `api` fails only on the missing `signature` in lesson mappers (fixed in Task 2).
- [x] **Step 6: Checkpoint.** `pnpm format`. Files of this task: the contracts files and the web files above.

### Task 2: Column, migration and signature in the lesson endpoints

**Files:**

- Modify: `packages/db/src/schema.ts`, `packages/db/src/seed.ts` (only: give every seeded lesson `EMPTY` signature so it keeps running; rewritten in Task 4)
- Create: `packages/db/migrations/0003_lesson_signature.sql` (+ drizzle `meta` snapshot and journal entry)
- Create: `apps/api/src/modules/lessons/signature.ts`
- Modify: `apps/api/src/modules/lessons/admin-lessons.repository.ts`, `apps/api/src/modules/lessons/library.repository.ts`, `apps/api/test/fixtures.ts`
- Test: `apps/api/src/modules/lessons/admin-lessons.test.ts`, `apps/api/src/modules/lessons/library.test.ts`

**Interfaces:**

- Consumes: Task 1 `SignatureSchema`, `Signature`, `EMPTY_SIGNATURE_V1`.
- Produces:
  - `schema.ts`: `export type LessonSignatureJson = { version: string; slots: { instruments: string[]; comment: string }[] }` (doc comment: shape validated by `SignatureSchema` in contracts, ADR-0050); `lessons.signature = jsonb("signature").$type<LessonSignatureJson>().notNull()`.
  - `apps/api/src/modules/lessons/signature.ts`: `toSignature(json: LessonSignatureJson): Signature` (= `SignatureSchema.parse(json)`; a stored value that fails is a `500`, never passed on unvalidated).
  - `apps/api/test/fixtures.ts`: `TEST_SIGNATURE: Signature` (8 × `{ instruments: ["snare"], comment: "" }`), the default `signature` of `insertLesson` (non-empty, so existing tests that publish fixture lessons keep passing).

- [x] **Step 1: Write the failing tests** (`input()` in `admin-lessons.test.ts` gains `signature: TEST_SIGNATURE`):
  - `create` stores and returns the signature: `POST` with a money-beat signature → `201`, `body.signature` equals it, `GET` returns the same;
  - `create` with `EMPTY_SIGNATURE_V1` → `201` (drafts may be empty);
  - stored JSON is exactly the contract: `POST` with `{ ...money, bpm: 90 }` and `accent: true` on slot 0 → `201`, and `ctx.db.select({ s: lessons.signature }).from(lessons)` equals the money beat without the extra keys;
  - comment trimmed through the API: slot 0 comment `" R "` → stored `"R"`;
  - invalid signature → `400 VALIDATION_ERROR` with `details` containing `{ path: "signature.slots.0.comment", message: "A comment can be at most 3 characters" }` for comment `"RLRL"`, and a detail with path `signature.slots` for 7 slots;
  - `update` replaces the signature of a draft;
  - `library.test.ts` details: `GET /api/lessons/:id` includes `signature` equal to the inserted one; the library list items have no `signature` key.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- lessons`. Expected: FAIL.
- [x] **Step 3: Add the column and migration.** Add the column in `schema.ts`, run `scripts/with-node.sh pnpm --filter @drum-tutor/db generate --name lesson_signature`, then hand-edit the generated SQL like `0002`: add the column with `DEFAULT '{"version":"v1","slots":[…8 × {"instruments":[],"comment":""}…]}'::jsonb NOT NULL`, then `ALTER COLUMN "signature" DROP DEFAULT`, with a comment pointing to ADR-0053 / spec §5. The snapshot stays as generated (no default), which matches the final state.
- [x] **Step 4: Implement the API part.** `lessonValues(input)` adds `signature: input.signature` (the parsed body: trimmed, unknown keys dropped). `toAdminLesson` and `getPublishedLesson` add `signature: toSignature(row.signature)`. Summaries stay as they are. `insertLesson` defaults `signature` to `TEST_SIGNATURE`. In `seed.ts`, add an empty v1 literal to every lesson so `db:seed` and `seed.test.ts` keep working until Task 4.
- [x] **Step 5: Run** `scripts/with-node.sh pnpm typecheck` and the full API suite. Expected: PASS.
- [x] **Step 6: Checkpoint.** `pnpm format`. Files of this task: the files above.

### Task 3: Publishing and keeping published require notes

**Files:**

- Modify: `apps/api/src/modules/lessons/admin-lessons.repository.ts`, `apps/api/src/modules/lessons/admin-lessons.routes.ts`, `apps/api/src/modules/lessons/signature.ts`
- Test: `apps/api/src/modules/lessons/admin-lessons.test.ts`

**Interfaces:**

- Consumes: Task 1 `signatureHasNotes`, `ApiErrorCode.SIGNATURE_EMPTY`; Task 2 `toSignature`.
- Produces: `signatureEmpty(): AppError` in `signature.ts` (`409`, `SIGNATURE_EMPTY`, copy table). `lockUnloggedLesson(tx, id)` returns `{ status: LessonStatus; signature: LessonSignatureJson }` instead of `void`.

- [x] **Step 1: Write the failing tests** (new `describe("signature rules")`):
  - publish a draft with `EMPTY_SIGNATURE_V1` → `409`, `error.code === "SIGNATURE_EMPTY"`, message from the copy table; `GET` still shows `status: "draft"`;
  - publish a draft with one note → `200`, `status: "published"`;
  - **legacy row** (Review Focus 1): `insertLesson({ status: "published", signature: EMPTY_SIGNATURE_V1, … })`, then publish → `409`; unpublish → `200`, `status: "draft"`;
  - `PUT` a published lesson (no logs) with `EMPTY_SIGNATURE_V1` → `409 SIGNATURE_EMPTY`, and `GET` shows the old signature and name unchanged even though the body also changed the name;
  - `PUT` a draft with `EMPTY_SIGNATURE_V1` → `200`;
  - `PUT` a published lesson **with practice logs** and `EMPTY_SIGNATURE_V1` → `409 LESSON_LOCKED` (Review Focus 4);
  - **race** (Review Focus 5): a draft with notes; `Promise.all([PUT with EMPTY_SIGNATURE_V1, publish])` → afterwards `GET` shows either `{ status: "draft", signature empty }` or `{ status: "published", signature with notes }`. Run the pair 10 times on fresh lessons; never `published` + empty, never a `500`;
  - the OpenAPI document lists `409` for `POST /api/admin/lessons/{id}/publish`.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- admin-lessons`. Expected: FAIL.
- [x] **Step 3: Implement.**
  - `publishLesson`: in its transaction, `select({ signature }) … for("update")` first (404 if none), throw `signatureEmpty()` when `!signatureHasNotes(toSignature(row.signature))`, then update as today.
  - `updateLesson`: use the status from `lockUnloggedLesson`; when it is `published` and `!signatureHasNotes(input.signature)`, throw `signatureEmpty()` before any write. Order: lock and logs check first (so `LESSON_LOCKED` wins), then the signature rule, then tags.
  - Publish route: add `409: ApiErrorSchema`; change its summary to "Publish a lesson (idempotent); refused while the signature has no notes".
- [x] **Step 4: Run** the full API suite. Expected: PASS. In particular, the existing "still allows publishing a lesson with practice logs" and "publishes idempotently" tests pass unchanged thanks to `TEST_SIGNATURE`.
- [x] **Step 5: Checkpoint.** `pnpm format`. Files of this task: the files above.

### Task 4: Seed with real v1 signatures

**Files:**

- Modify: `packages/db/src/seed.ts`
- Test: `apps/api/src/seed.test.ts`
- Modify (docs): this plan (status, checkboxes, Execution notes), `docs/specs/README.md` (signature row: `plan-01-backend.md (done)`)

**Interfaces:**

- Consumes: Task 2 column and `LessonSignatureJson`; Tasks 2–3 endpoints (the test reads through the API).
- Produces: `seedDatabase(db)` unchanged in signature. Data per spec §5.1. In `seed.ts`, a local `signatureFromGrid(grid: string): LessonSignatureJson`, so each seed lesson carries its row of the spec table literally.

`signatureFromGrid` grammar (the spec §5.1 notation): 8 whitespace-separated tokens. Each token is `-` (rest) or a run of `H`/`S`/`K` (`hihat-closed`/`snare`/`kick`, in any order), optionally followed by `(comment)`. Any other count or character throws, so a typo fails `db:seed` instead of storing garbage. `S(L) ×8` from the table is written out as 8 tokens.

- [x] **Step 1: Update the failing test** `seed.test.ts`, inside `check()`:
  - the existing counts still hold (18 lessons, 15 published, 3 drafts, 6 tags, 3 locked, at least 4 tags across the locked lessons, 1–3 tags per lesson, `createdAt` rules);
  - the locked lessons' names are exactly `["Money beat", "Single paradiddles", "Weak hand eighth notes"]` (sorted);
  - for every admin list item, `GET /api/admin/lessons/:id` parses with `AdminLessonSchema` (so every stored signature passes the contract), and every `published` one satisfies `signatureHasNotes`;
  - "Hi-hat foot chicks on 2&4" is a draft with `signatureHasNotes === false`;
  - "Money beat"'s signature equals the spec grid `HK H HS H HK H HS H` (instrument sets compared per slot, order-insensitive), and "Single strokes on a pad" has comments `R L R L R L R L`;
  - the names "Sixteenth-note hi-hat groove", "Triplet fill around the toms" and "Flam taps" are absent.
- [x] **Step 2: Run** `scripts/with-node.sh pnpm --filter @drum-tutor/api test -- seed`. Expected: FAIL.
- [x] **Step 3: Implement.** Replace `LESSONS` with the 18 lessons of spec §5.1, in the table's order (index = `#`). Each lesson gets a `signature` grid string and a two-to-three sentence description matching its pattern (what to play, what to focus on, a tempo hint). The description of lesson 17 says the hi-hat foot cannot be written in the current notation yet, which is why it stays a draft. `LOGGED_LESSON_INDEXES` stays `[1, 2, 5]`. History generation and `created_at` logic stay as they are.
- [x] **Step 4: Run** `scripts/with-node.sh pnpm lint && scripts/with-node.sh pnpm typecheck && scripts/with-node.sh pnpm test`. Expected: all PASS.
- [x] **Step 5: Verify against the local app.** Start the stack with the `local-dev` skill, then `scripts/with-node.sh pnpm db:migrate && scripts/with-node.sh pnpm db:seed`. Log in with `curl -c` as `seed@example.com`, then:
  - `GET /api/lessons?pageSize=100` lists 15 lessons without `signature`;
  - `GET /api/lessons/<Four on the floor id>` returns the `HK H HKS H HK H HKS H` signature;
  - `POST /api/admin/lessons/<Hi-hat foot chicks id>/publish` returns `409 SIGNATURE_EMPTY`;
  - `/api/docs` shows `signature` on the lesson schemas and `409` on publish.
- [x] **Step 6: Checkpoint.** `pnpm format`. Tick this plan's checkboxes, set its status to `done`, update the signature row in `docs/specs/README.md`. Files of this task: the files above.

## Execution notes

<!-- Filled in during execution: any decision taken while building. -->

- **Commits.** None made: the user's global rule requires an explicit ask before any commit, so all plan-01 changes are left uncommitted for the user.
- **Task 1.** Turbo's `typecheck` task has no `dependsOn: ["^typecheck"]`, so after a contracts change it replays a cached `api` pass. This plan ran `pnpm typecheck --force`. The turbo config is unchanged (reported to the user).
- **Task 2.** The existing exact-shape test "replaces all fields and the tag set of a published lesson" now sends and expects a money-beat signature, since the response gained the field.
- **Task 3.** `lockUnloggedLesson` returns only `{ status }`: the update rule checks the incoming signature, so the stored one is never needed.
- **Task 4.** `signatureFromGrid` stays private to `seed.ts`; the seed test proves every grid parses and matches the contract.
- **Task 4, local check (2026-10-26).** After `db:migrate` and `db:seed`: the library lists 15 lessons without `signature`, "Four on the floor" returns `v1 HK H HKS H HK H HKS H`, publishing "Hi-hat foot chicks on 2&4" returns `409 SIGNATURE_EMPTY`, and OpenAPI lists `409` on publish and `signature` on the lesson detail.

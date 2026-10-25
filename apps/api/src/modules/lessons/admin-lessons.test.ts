import { randomUUID } from "node:crypto";
import {
  AdminLessonSchema,
  AdminLessonSummarySchema,
  ApiErrorSchema,
  ApiPaths,
  type LessonInput,
  pageSchema,
  withId,
} from "@drum-tutor/contracts";
import { lessons, lessonTags, type TagRow } from "@drum-tutor/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertLesson, insertPracticeLog, insertTag, loginCookies } from "../../../test/fixtures";
import { createTestApp, resetDatabase } from "../../../test/helpers";

const AdminLessonPageSchema = pageSchema(AdminLessonSummarySchema);
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const LOCKED_MESSAGE = "This lesson has practice logs and can't be changed";

describe("admin lesson endpoints", () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let cookies: Record<string, string>;
  let groove: TagRow;
  let accents: TagRow;
  let snare: TagRow;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.db);
    cookies = await loginCookies(ctx.app);
    groove = await insertTag(ctx.db, "Groove");
    accents = await insertTag(ctx.db, "accents");
    snare = await insertTag(ctx.db, "Snare");
  });

  const input = (overrides: Partial<LessonInput> = {}): LessonInput => ({
    name: "Paradiddle groove",
    description: "Play paradiddles between hi-hat and snare.",
    difficulty: "intermediate",
    tagIds: [groove.id],
    recommendedTempoBpm: 90,
    recommendedDurationSeconds: 300,
    ...overrides,
  });
  const create = (payload: unknown) =>
    ctx.app.inject({
      method: "POST",
      url: ApiPaths.adminLessons,
      cookies,
      payload: payload as object,
    });
  const update = (id: string, payload: unknown) =>
    ctx.app.inject({
      method: "PUT",
      url: withId(ApiPaths.adminLesson, id),
      cookies,
      payload: payload as object,
    });
  const read = (id: string) =>
    ctx.app.inject({ method: "GET", url: withId(ApiPaths.adminLesson, id), cookies });
  const del = (id: string) =>
    ctx.app.inject({ method: "DELETE", url: withId(ApiPaths.adminLesson, id), cookies });
  const publish = (id: string) =>
    ctx.app.inject({ method: "POST", url: withId(ApiPaths.adminLessonPublish, id), cookies });
  const unpublish = (id: string) =>
    ctx.app.inject({ method: "POST", url: withId(ApiPaths.adminLessonUnpublish, id), cookies });
  const errorOf = (res: { json(): unknown }) => ApiErrorSchema.parse(res.json()).error;
  const lessonCount = async () => (await ctx.db.select().from(lessons)).length;
  const tagIdsOf = async (lessonId: string) =>
    (await ctx.db.select().from(lessonTags).where(eq(lessonTags.lessonId, lessonId)))
      .map((row) => row.tagId)
      .sort();

  describe("create", () => {
    it("creates a draft, unlocked lesson with its tags sorted by name", async () => {
      const res = await create(input({ tagIds: [snare.id, groove.id, accents.id] }));
      expect(res.statusCode).toBe(201);
      const body = AdminLessonSchema.parse(res.json());
      expect(body).toMatchObject({
        name: "Paradiddle groove",
        description: "Play paradiddles between hi-hat and snare.",
        difficulty: "intermediate",
        recommendedTempoBpm: 90,
        recommendedDurationSeconds: 300,
        status: "draft",
        locked: false,
      });
      expect(body.tags.map((t) => t.name)).toEqual(["accents", "Groove", "Snare"]);
      expect(AdminLessonSchema.parse((await read(body.id)).json())).toEqual(body);
    });

    it("always creates a draft, even when the body asks for published", async () => {
      const res = await create({ ...input(), status: "published" });
      expect(res.statusCode).toBe(201);
      expect(AdminLessonSchema.parse(res.json()).status).toBe("draft");
    });

    it.each([
      ["no tags", { tagIds: [] }, "Choose at least one tag"],
      [
        "11 tags",
        { tagIds: Array.from({ length: 11 }, () => randomUUID()) },
        "A lesson can have at most 10 tags",
      ],
      ["tempo 29", { recommendedTempoBpm: 29 }, "Tempo must be between 30 and 300 BPM"],
      ["tempo 301", { recommendedTempoBpm: 301 }, "Tempo must be between 30 and 300 BPM"],
      ["duration 0", { recommendedDurationSeconds: 0 }, "Duration must be between 0:30 and 60:00"],
      [
        "duration 15",
        { recommendedDurationSeconds: 15 },
        "Duration must be between 0:30 and 60:00",
      ],
      ["duration 45", { recommendedDurationSeconds: 45 }, "Duration must be in 30-second steps"],
      [
        "duration 3630",
        { recommendedDurationSeconds: 3630 },
        "Duration must be between 0:30 and 60:00",
      ],
    ] as const)("rejects %s with 400", async (_label, overrides, message) => {
      const res = await create(input(overrides as Partial<LessonInput>));
      expect(res.statusCode).toBe(400);
      const error = errorOf(res);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details?.map((d) => d.message)).toContain(message);
      expect(await lessonCount()).toBe(0);
    });

    it("rejects a repeated tag with 400, not a primary key error", async () => {
      const res = await create(input({ tagIds: [groove.id, groove.id] }));
      expect(res.statusCode).toBe(400);
      const error = errorOf(res);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toContainEqual({
        path: "tagIds",
        message: "A tag can only be selected once",
      });
      expect(await lessonCount()).toBe(0);
    });

    it.each([
      { recommendedTempoBpm: 30 },
      { recommendedTempoBpm: 300 },
      { recommendedDurationSeconds: 30 },
      { recommendedDurationSeconds: 3600 },
    ])("accepts the boundary %o", async (overrides) => {
      const res = await create(input(overrides));
      expect(res.statusCode).toBe(201);
      expect(AdminLessonSchema.parse(res.json())).toMatchObject(overrides);
    });

    it("rejects unknown tag ids with one detail each and creates nothing", async () => {
      const first = randomUUID();
      const second = randomUUID();
      const res = await create(input({ tagIds: [groove.id, first, second] }));
      expect(res.statusCode).toBe(400);
      const error = errorOf(res);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.message).toBe("Invalid request");
      expect(error.details).toHaveLength(2);
      expect(error.details).toEqual(
        expect.arrayContaining([
          { path: "tagIds", message: `Unknown tag: ${first}` },
          { path: "tagIds", message: `Unknown tag: ${second}` },
        ]),
      );
      expect(await lessonCount()).toBe(0);
    });
  });

  describe("update", () => {
    it("replaces all fields and the tag set of a published lesson, keeping status and createdAt", async () => {
      const lesson = await insertLesson(ctx.db, {
        tagIds: [groove.id, accents.id],
        status: "published",
      });
      const next = input({
        name: "Linear fills",
        description: "Fills with no two limbs at once.",
        difficulty: "advanced",
        tagIds: [snare.id],
        recommendedTempoBpm: 120,
        recommendedDurationSeconds: 600,
      });
      const res = await update(lesson.id, { ...next, status: "draft" });
      expect(res.statusCode).toBe(200);
      const body = AdminLessonSchema.parse(res.json());
      expect(body).toEqual({
        id: lesson.id,
        name: "Linear fills",
        description: "Fills with no two limbs at once.",
        difficulty: "advanced",
        tags: [{ id: snare.id, name: "Snare" }],
        recommendedTempoBpm: 120,
        recommendedDurationSeconds: 600,
        createdAt: lesson.createdAt.toISOString(),
        status: "published",
        locked: false,
      });
      expect(await tagIdsOf(lesson.id)).toEqual([snare.id]);
    });

    it.each([
      ["tempo above 300", { recommendedTempoBpm: 301 }],
      ["duration not a 30-second step", { recommendedDurationSeconds: 45 }],
    ])("rejects %s and leaves the lesson unchanged", async (_label, override) => {
      const lesson = await insertLesson(ctx.db, { tagIds: [groove.id] });
      const before = (await read(lesson.id)).json();
      const res = await update(lesson.id, input(override));
      expect(res.statusCode).toBe(400);
      expect(errorOf(res).code).toBe("VALIDATION_ERROR");
      expect((await read(lesson.id)).json()).toEqual(before);
    });

    it("updates a draft without changing its status", async () => {
      const lesson = await insertLesson(ctx.db, { tagIds: [groove.id] });
      const res = await update(lesson.id, input({ name: "Renamed" }));
      expect(res.statusCode).toBe(200);
      expect(AdminLessonSchema.parse(res.json())).toMatchObject({
        name: "Renamed",
        status: "draft",
      });
    });

    it("rejects unknown tag ids and leaves the lesson unchanged", async () => {
      const lesson = await insertLesson(ctx.db, { tagIds: [groove.id] });
      const before = AdminLessonSchema.parse((await read(lesson.id)).json());
      const missing = randomUUID();
      const res = await update(lesson.id, input({ name: "Changed", tagIds: [missing] }));
      expect(res.statusCode).toBe(400);
      expect(errorOf(res).details).toEqual([
        { path: "tagIds", message: `Unknown tag: ${missing}` },
      ]);
      expect(AdminLessonSchema.parse((await read(lesson.id)).json())).toEqual(before);
    });

    it("returns 404 for an unknown lesson", async () => {
      const res = await update(UNKNOWN_ID, input());
      expect(res.statusCode).toBe(404);
      expect(errorOf(res)).toMatchObject({ code: "NOT_FOUND", message: "Lesson not found" });
    });
  });

  describe("locking", () => {
    it("refuses PUT, DELETE and unpublish on a lesson with practice logs, changing nothing", async () => {
      const lesson = await insertLesson(ctx.db, { tagIds: [groove.id], status: "published" });
      await insertPracticeLog(ctx.db, lesson.id);
      const before = AdminLessonSchema.parse((await read(lesson.id)).json());
      expect(before.locked).toBe(true);

      for (const res of [
        await update(lesson.id, input({ name: "Changed", tagIds: [snare.id] })),
        await del(lesson.id),
        await unpublish(lesson.id),
      ]) {
        expect(res.statusCode).toBe(409);
        expect(errorOf(res)).toMatchObject({ code: "LESSON_LOCKED", message: LOCKED_MESSAGE });
      }

      expect(AdminLessonSchema.parse((await read(lesson.id)).json())).toEqual(before);
      expect(await tagIdsOf(lesson.id)).toEqual([groove.id]);
    });

    it("still allows publishing a lesson with practice logs", async () => {
      const published = await insertLesson(ctx.db, { tagIds: [groove.id], status: "published" });
      const draft = await insertLesson(ctx.db, { tagIds: [groove.id], status: "draft" });
      await insertPracticeLog(ctx.db, published.id);
      await insertPracticeLog(ctx.db, draft.id);

      const again = await publish(published.id);
      expect(again.statusCode).toBe(200);
      expect(AdminLessonSchema.parse(again.json())).toMatchObject({
        status: "published",
        locked: true,
      });
      const first = await publish(draft.id);
      expect(first.statusCode).toBe(200);
      expect(AdminLessonSchema.parse(first.json())).toMatchObject({
        status: "published",
        locked: true,
      });
    });

    it("refuses an unpublish that waited for an in-flight practice log", async () => {
      const lesson = await insertLesson(ctx.db, { tagIds: [groove.id], status: "published" });
      let logInserted!: () => void;
      let commitLog!: () => void;
      const inserted = new Promise<void>((resolve) => {
        logInserted = resolve;
      });
      const commit = new Promise<void>((resolve) => {
        commitLog = resolve;
      });
      // The log insert holds a key-share lock on the lesson row until it commits.
      const writer = ctx.db.transaction(async (tx) => {
        await insertPracticeLog(tx as unknown as typeof ctx.db, lesson.id);
        logInserted();
        await commit;
      });
      await inserted;
      const pending = Promise.resolve(unpublish(lesson.id));
      await new Promise((resolve) => setTimeout(resolve, 200));
      commitLog();
      await writer;

      const res = await pending;
      expect(res.statusCode).toBe(409);
      expect(errorOf(res).code).toBe("LESSON_LOCKED");
      expect(AdminLessonSchema.parse((await read(lesson.id)).json()).status).toBe("published");
    });
  });

  describe("lifecycle", () => {
    const library = () => ctx.app.inject({ method: "GET", url: ApiPaths.lessons, cookies });
    const libraryDetail = (id: string) =>
      ctx.app.inject({ method: "GET", url: withId(ApiPaths.lesson, id), cookies });
    const idsOf = (res: { json(): unknown }) =>
      (res.json() as { items: { id: string }[] }).items.map((i) => i.id);

    it("unpublishes a published lesson without logs back to draft", async () => {
      const lesson = await insertLesson(ctx.db, { tagIds: [groove.id], status: "published" });
      const res = await unpublish(lesson.id);
      expect(res.statusCode).toBe(200);
      expect(AdminLessonSchema.parse(res.json())).toMatchObject({ status: "draft", locked: false });
    });

    it("shows a published lesson in the library and hides it again once unpublished", async () => {
      const lesson = await insertLesson(ctx.db, { tagIds: [groove.id] });

      expect((await publish(lesson.id)).statusCode).toBe(200);
      expect(idsOf(await library())).toEqual([lesson.id]);
      expect((await libraryDetail(lesson.id)).statusCode).toBe(200);

      expect((await unpublish(lesson.id)).statusCode).toBe(200);
      expect(idsOf(await library())).toEqual([]);
      const hidden = await libraryDetail(lesson.id);
      expect(hidden.statusCode).toBe(404);
      expect(errorOf(hidden).message).toBe("Lesson not found");
    });

    it("returns a draft with practice logs unchanged on unpublish", async () => {
      const lesson = await insertLesson(ctx.db, { tagIds: [groove.id] });
      await insertPracticeLog(ctx.db, lesson.id);
      const before = AdminLessonSchema.parse((await read(lesson.id)).json());
      const res = await unpublish(lesson.id);
      expect(res.statusCode).toBe(200);
      expect(AdminLessonSchema.parse(res.json())).toEqual(before);
      expect(before.status).toBe("draft");
    });

    it("publishes idempotently and treats unpublishing a draft as a no-op", async () => {
      const lesson = await insertLesson(ctx.db, { tagIds: [groove.id] });
      const before = AdminLessonSchema.parse((await read(lesson.id)).json());

      const unpublished = await unpublish(lesson.id);
      expect(unpublished.statusCode).toBe(200);
      expect(AdminLessonSchema.parse(unpublished.json())).toEqual(before);

      const first = await publish(lesson.id);
      expect(first.statusCode).toBe(200);
      const published = AdminLessonSchema.parse(first.json());
      expect(published).toEqual({ ...before, status: "published" });
      const second = await publish(lesson.id);
      expect(second.statusCode).toBe(200);
      expect(AdminLessonSchema.parse(second.json())).toEqual(published);
    });

    it("returns 404 publishing or unpublishing an unknown lesson", async () => {
      expect((await publish(UNKNOWN_ID)).statusCode).toBe(404);
      expect((await unpublish(UNKNOWN_ID)).statusCode).toBe(404);
    });

    it("deletes a lesson without logs together with its tag links", async () => {
      const lesson = await insertLesson(ctx.db, {
        tagIds: [groove.id, snare.id],
        status: "published",
      });
      const res = await del(lesson.id);
      expect(res.statusCode).toBe(204);
      expect(await lessonCount()).toBe(0);
      expect(await tagIdsOf(lesson.id)).toEqual([]);
      expect((await read(lesson.id)).statusCode).toBe(404);
    });

    it("returns 404 deleting an unknown lesson", async () => {
      const res = await del(UNKNOWN_ID);
      expect(res.statusCode).toBe(404);
      expect(errorOf(res).message).toBe("Lesson not found");
    });
  });

  describe("list and read", () => {
    it("lists drafts and published lessons newest first, with locked and correct totals", async () => {
      const at = (iso: string) => new Date(iso);
      const oldest = await insertLesson(ctx.db, {
        name: "Oldest",
        tagIds: [snare.id, accents.id],
        status: "published",
        createdAt: at("2026-01-01T00:00:00.000Z"),
      });
      const tieA = await insertLesson(ctx.db, {
        name: "Tie A",
        tagIds: [groove.id],
        createdAt: at("2026-02-01T00:00:00.000Z"),
      });
      const tieB = await insertLesson(ctx.db, {
        name: "Tie B",
        tagIds: [groove.id],
        status: "published",
        createdAt: at("2026-02-01T00:00:00.000Z"),
      });
      await insertPracticeLog(ctx.db, oldest.id);
      const ties = [tieA, tieB].sort((a, b) => (a.id < b.id ? 1 : -1)).map((l) => l.id);

      const get = async (query: string) => {
        const res = await ctx.app.inject({
          method: "GET",
          url: `${ApiPaths.adminLessons}${query}`,
          cookies,
        });
        expect(res.statusCode).toBe(200);
        return AdminLessonPageSchema.parse(res.json());
      };

      const all = await get("");
      expect(all).toMatchObject({ page: 1, pageSize: 20, totalItems: 3, totalPages: 1 });
      expect(all.items.map((l) => l.id)).toEqual([...ties, oldest.id]);
      expect(all.items.map((l) => [l.id, l.locked])).toEqual([
        [ties[0], false],
        [ties[1], false],
        [oldest.id, true],
      ]);
      const last = all.items[2];
      expect(last).toMatchObject({ status: "published", createdAt: "2026-01-01T00:00:00.000Z" });
      expect(last?.tags.map((t) => t.name)).toEqual(["accents", "Snare"]);
      expect(all.items.map((l) => l.status).sort()).toEqual(["draft", "published", "published"]);

      const second = await get("?page=2&pageSize=2");
      expect(second).toMatchObject({ page: 2, pageSize: 2, totalItems: 3, totalPages: 2 });
      expect(second.items.map((l) => l.id)).toEqual([oldest.id]);
    });

    it("rejects a pageSize above 100", async () => {
      const res = await ctx.app.inject({
        method: "GET",
        url: `${ApiPaths.adminLessons}?pageSize=101`,
        cookies,
      });
      expect(res.statusCode).toBe(400);
      expect(errorOf(res).code).toBe("VALIDATION_ERROR");
    });

    it("returns 404 Lesson not found for an unknown id", async () => {
      const res = await read(UNKNOWN_ID);
      expect(res.statusCode).toBe(404);
      expect(errorOf(res)).toMatchObject({ code: "NOT_FOUND", message: "Lesson not found" });
    });

    it.each([
      ["GET", ApiPaths.adminLesson],
      ["PUT", ApiPaths.adminLesson],
      ["DELETE", ApiPaths.adminLesson],
      ["POST", ApiPaths.adminLessonPublish],
      ["POST", ApiPaths.adminLessonUnpublish],
    ] as const)("returns 400 for a malformed id on %s %s", async (method, path) => {
      const res = await ctx.app.inject({
        method,
        url: withId(path, "not-a-uuid"),
        cookies,
        ...(method === "PUT" ? { payload: input() } : {}),
      });
      expect(res.statusCode).toBe(400);
      expect(errorOf(res).code).toBe("VALIDATION_ERROR");
    });
  });

  it.each([
    ["GET", ApiPaths.adminLessons],
    ["POST", ApiPaths.adminLessons],
    ["GET", ApiPaths.adminLesson],
    ["PUT", ApiPaths.adminLesson],
    ["DELETE", ApiPaths.adminLesson],
    ["POST", ApiPaths.adminLessonPublish],
    ["POST", ApiPaths.adminLessonUnpublish],
  ] as const)("requires a session on %s %s", async (method, path) => {
    const lesson = await insertLesson(ctx.db, { tagIds: [groove.id] });
    const withBody = path === ApiPaths.adminLessons ? method === "POST" : method === "PUT";
    const res = await ctx.app.inject({
      method,
      url: withId(path, lesson.id),
      ...(withBody ? { payload: input() } : {}),
    });
    expect(res.statusCode).toBe(401);
    expect(errorOf(res).code).toBe("UNAUTHENTICATED");
    expect(await lessonCount()).toBe(1);
  });

  it("lists the admin lesson paths in the OpenAPI document", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/docs/json" });
    expect(res.statusCode).toBe(200);
    const paths = Object.keys((res.json() as { paths: Record<string, unknown> }).paths);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/api/admin/lessons",
        "/api/admin/lessons/{id}",
        "/api/admin/lessons/{id}/publish",
        "/api/admin/lessons/{id}/unpublish",
      ]),
    );
  });
});

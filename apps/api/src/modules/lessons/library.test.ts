import {
  ApiErrorSchema,
  ApiPaths,
  LessonDetailSchema,
  LessonSummarySchema,
  pageSchema,
  withId,
} from "@drum-tutor/contracts";
import type { TagRow } from "@drum-tutor/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  insertLesson,
  insertPracticeLog,
  insertRating,
  insertTag,
  insertUser,
  loginCookies,
  TEST_SIGNATURE,
} from "../../../test/fixtures";
import { createTestApp, resetDatabase } from "../../../test/helpers";

const LibraryPageSchema = pageSchema(LessonSummarySchema);
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";

describe("drummer library endpoints", () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let cookies: Record<string, string>;
  let a: TagRow;
  let b: TagRow;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.db);
    cookies = await loginCookies(ctx.app);
    a = await insertTag(ctx.db, "Alpha");
    b = await insertTag(ctx.db, "Bravo");
  });

  const list = (query = "") =>
    ctx.app.inject({ method: "GET", url: `${ApiPaths.lessons}${query}`, cookies });
  const listPage = async (query = "") => {
    const res = await list(query);
    expect(res.statusCode).toBe(200);
    return LibraryPageSchema.parse(res.json());
  };
  const names = async (query = "") => (await listPage(query)).items.map((i) => i.name);
  const published = (values: Parameters<typeof insertLesson>[1]) =>
    insertLesson(ctx.db, { status: "published", ...values });

  it("never lists drafts and hides a draft's details", async () => {
    await published({ name: "Live", tagIds: [a.id] });
    const draft = await insertLesson(ctx.db, { name: "Draft", tagIds: [a.id] });
    expect(await names()).toEqual(["Live"]);
    expect((await listPage()).totalItems).toBe(1);
    const res = await ctx.app.inject({
      method: "GET",
      url: withId(ApiPaths.lesson, draft.id),
      cookies,
    });
    expect(res.statusCode).toBe(404);
    expect(ApiErrorSchema.parse(res.json()).error.message).toBe("Lesson not found");
  });

  describe("tag filter", () => {
    beforeEach(async () => {
      await published({ name: "Both", tagIds: [a.id, b.id] });
      await published({ name: "Only A", tagIds: [a.id] });
      await published({ name: "Only B", tagIds: [b.id] });
    });

    it("requires every selected tag", async () => {
      expect(await names(`?tagIds=${a.id}&tagIds=${b.id}`)).toEqual(["Both"]);
    });
    it("accepts a single key", async () => {
      expect((await names(`?tagIds=${a.id}`)).sort()).toEqual(["Both", "Only A"]);
    });
    it("treats a repeated id like one id", async () => {
      expect((await names(`?tagIds=${a.id}&tagIds=${a.id}`)).sort()).toEqual(["Both", "Only A"]);
    });
    it("rejects a malformed id with 400", async () => {
      const res = await list("?tagIds=garbage");
      expect(res.statusCode).toBe(400);
      ApiErrorSchema.parse(res.json());
    });
    it("returns an empty page for an unknown tag", async () => {
      const page = await listPage(`?tagIds=${UNKNOWN_ID}`);
      expect(page.items).toEqual([]);
      expect(page.totalItems).toBe(0);
      expect(page.totalPages).toBe(0);
    });
    it("counts only matching lessons", async () => {
      const page = await listPage(`?tagIds=${a.id}&tagIds=${b.id}`);
      expect(page.totalItems).toBe(1);
    });
  });

  describe("difficulty filter", () => {
    beforeEach(async () => {
      await published({ name: "Easy", difficulty: "beginner", tagIds: [a.id] });
      await published({ name: "Mid", difficulty: "intermediate", tagIds: [a.id] });
      await published({ name: "Hard", difficulty: "advanced", tagIds: [b.id] });
    });

    it("matches either level", async () => {
      expect((await names("?difficulties=beginner&difficulties=advanced")).sort()).toEqual([
        "Easy",
        "Hard",
      ]);
    });
    it("combines with tags", async () => {
      expect(await names(`?difficulties=beginner&difficulties=advanced&tagIds=${a.id}`)).toEqual([
        "Easy",
      ]);
    });
    it("rejects an unknown level", async () => {
      expect((await list("?difficulties=expert")).statusCode).toBe(400);
    });
  });

  describe("sorting", () => {
    it("orders by created_at", async () => {
      await published({ name: "Old", tagIds: [a.id], createdAt: new Date("2026-01-01") });
      await published({ name: "Mid", tagIds: [a.id], createdAt: new Date("2026-02-01") });
      await published({ name: "New", tagIds: [a.id], createdAt: new Date("2026-03-01") });
      expect(await names()).toEqual(["New", "Mid", "Old"]);
      expect(await names("?sort=newest")).toEqual(["New", "Mid", "Old"]);
      expect(await names("?sort=oldest")).toEqual(["Old", "Mid", "New"]);
    });

    it("breaks created_at ties by id", async () => {
      const createdAt = new Date("2026-01-01");
      const rows = await Promise.all(
        ["x", "y", "z"].map((name) => published({ name, tagIds: [a.id], createdAt })),
      );
      const ids = rows.map((r) => r.id).sort();
      const idsOf = async (query: string) => (await listPage(query)).items.map((i) => i.id);
      expect(await idsOf("?sort=newest")).toEqual([...ids].reverse());
      expect(await idsOf("?sort=oldest")).toEqual(ids);
    });
  });

  describe("rating", () => {
    const rateAll = async (lessonId: string, values: number[]) => {
      for (const [i, rating] of values.entries()) {
        const user = await insertUser(ctx.db, `rater-${lessonId}-${i}@example.com`);
        await insertRating(ctx.db, { lessonId, userId: user.id, rating });
      }
    };
    const detail = async (id: string) => {
      const res = await ctx.app.inject({
        method: "GET",
        url: withId(ApiPaths.lesson, id),
        cookies,
      });
      expect(res.statusCode).toBe(200);
      return LessonDetailSchema.parse(res.json());
    };
    const currentUserId = async () => (await insertUser(ctx.db, "user@example.com")).id;

    it("lists an unrated lesson with a null average", async () => {
      await published({ name: "Unrated", tagIds: [a.id] });
      expect((await listPage()).items[0]?.rating).toEqual({ average: null, count: 0 });
    });

    it("carries the average and count in the list and the detail", async () => {
      const lesson = await published({ name: "Rated", tagIds: [a.id] });
      await rateAll(lesson.id, [5, 4, 4]);
      expect((await listPage()).items[0]?.rating).toEqual({ average: 4.33, count: 3 });
      expect((await detail(lesson.id)).rating).toEqual({ average: 4.33, count: 3 });
    });

    describe("order", () => {
      const seed = async () => {
        const at = (iso: string) => new Date(iso);
        const lessonsByName: Record<string, string> = {};
        const make = async (name: string, createdAt: string, ratings: number[]) => {
          const lesson = await published({ name, tagIds: [a.id], createdAt: at(createdAt) });
          lessonsByName[name] = lesson.id;
          await rateAll(lesson.id, ratings);
        };
        await make("A", "2026-01-01", [5, 4]);
        await make("B", "2026-01-02", [5, 4, 5, 4]);
        await make("C", "2026-01-03", [5]);
        await make("D", "2026-01-04", []);
        await make("E", "2026-01-05", []);
        return lessonsByName;
      };

      it("sorts by average, then count, then newest, with unrated last", async () => {
        await seed();
        expect(await names("?sort=rating")).toEqual(["C", "B", "A", "E", "D"]);
        expect(await names()).toEqual(["C", "B", "A", "E", "D"]);
      });

      it("keeps the created_at order for newest and oldest on rated lessons", async () => {
        await seed();
        expect(await names("?sort=newest")).toEqual(["E", "D", "C", "B", "A"]);
        expect(await names("?sort=oldest")).toEqual(["A", "B", "C", "D", "E"]);
      });

      it("puts the newer lesson first when average and count are equal", async () => {
        const older = await published({
          name: "Older",
          tagIds: [a.id],
          createdAt: new Date("2026-01-01"),
        });
        const newer = await published({
          name: "Newer",
          tagIds: [a.id],
          createdAt: new Date("2026-02-01"),
        });
        await rateAll(older.id, [4, 5]);
        await rateAll(newer.id, [4, 5]);
        expect(await names("?sort=rating")).toEqual(["Newer", "Older"]);
      });

      it("pages through ties and the rated/unrated boundary without gaps or repeats", async () => {
        await seed();
        const all: string[] = [];
        for (const page of [1, 2, 3]) {
          const p = await listPage(`?pageSize=2&page=${page}`);
          expect(p.totalItems).toBe(5);
          all.push(...p.items.map((i) => i.name));
        }
        expect(all).toEqual(["C", "B", "A", "E", "D"]);
      });

      it("falls back to created_at then id for identical ratings", async () => {
        const createdAt = new Date("2026-01-01");
        const rows = await Promise.all(
          ["x", "y", "z"].map((name) => published({ name, tagIds: [a.id], createdAt })),
        );
        for (const row of rows) await rateAll(row.id, [4]);
        const ids = (await listPage()).items.map((i) => i.id);
        expect(ids).toEqual(
          rows
            .map((r) => r.id)
            .sort()
            .reverse(),
        );
      });

      it("keeps the filters and counts only the filtered set", async () => {
        const hard1 = await published({ name: "Hard1", difficulty: "advanced", tagIds: [a.id] });
        const hard2 = await published({ name: "Hard2", difficulty: "advanced", tagIds: [b.id] });
        const easy = await published({ name: "Easy", difficulty: "beginner", tagIds: [a.id] });
        await rateAll(hard1.id, [3]);
        await rateAll(hard2.id, [5]);
        await rateAll(easy.id, [5, 5]);
        const advanced = await listPage("?difficulties=advanced");
        expect(advanced.items.map((i) => i.name)).toEqual(["Hard2", "Hard1"]);
        expect(advanced.totalItems).toBe(2);
        const tagged = await listPage(`?tagIds=${a.id}`);
        expect(tagged.items.map((i) => i.name)).toEqual(["Easy", "Hard1"]);
        expect(tagged.totalItems).toBe(2);
      });
    });

    describe("detail: myRating and canRate", () => {
      it("is not rateable without a log", async () => {
        const lesson = await published({ name: "L", tagIds: [a.id] });
        const body = await detail(lesson.id);
        expect(body.canRate).toBe(false);
        expect(body.myRating).toBeNull();
      });

      it("is not rateable with a log of another lesson only", async () => {
        const lesson = await published({ name: "L", tagIds: [a.id] });
        const other = await published({ name: "Other", tagIds: [a.id] });
        await insertPracticeLog(ctx.db, other.id, { userId: await currentUserId() });
        expect((await detail(lesson.id)).canRate).toBe(false);
      });

      it("is rateable with a log and not yet rated", async () => {
        const lesson = await published({ name: "L", tagIds: [a.id] });
        await insertPracticeLog(ctx.db, lesson.id, { userId: await currentUserId() });
        const body = await detail(lesson.id);
        expect(body.canRate).toBe(true);
        expect(body.myRating).toBeNull();
      });

      it("returns the caller's own rating only", async () => {
        const lesson = await published({ name: "L", tagIds: [a.id] });
        const userId = await currentUserId();
        await insertPracticeLog(ctx.db, lesson.id, { userId });
        const other = await insertUser(ctx.db, "other@example.com");
        await insertRating(ctx.db, { lessonId: lesson.id, userId: other.id, rating: 1 });
        expect((await detail(lesson.id)).myRating).toBeNull();
        await insertRating(ctx.db, { lessonId: lesson.id, userId, rating: 3 });
        const body = await detail(lesson.id);
        expect(body.myRating).toBe(3);
        expect(body.rating).toEqual({ average: 2, count: 2 });
      });

      it("leaves myRating and canRate out of the list", async () => {
        await published({ name: "L", tagIds: [a.id] });
        const item = (await list()).json().items[0];
        expect(item).not.toHaveProperty("myRating");
        expect(item).not.toHaveProperty("canRate");
      });
    });
  });

  describe("pagination", () => {
    it("pages with consistent totals", async () => {
      for (let i = 0; i < 13; i++) await published({ name: `L${i}`, tagIds: [a.id] });
      const p1 = await listPage("?pageSize=12");
      const p2 = await listPage("?pageSize=12&page=2");
      const p3 = await listPage("?pageSize=12&page=3");
      expect([p1.items.length, p2.items.length, p3.items.length]).toEqual([12, 1, 0]);
      for (const p of [p1, p2, p3]) {
        expect(p.totalItems).toBe(13);
        expect(p.totalPages).toBe(2);
      }
    });
    it("rejects out-of-range page sizes", async () => {
      expect((await list("?pageSize=0")).statusCode).toBe(400);
      expect((await list("?pageSize=101")).statusCode).toBe(400);
    });
  });

  it("requires a session", async () => {
    const res = await ctx.app.inject({ method: "GET", url: ApiPaths.lessons });
    expect(res.statusCode).toBe(401);
    const one = await ctx.app.inject({ method: "GET", url: withId(ApiPaths.lesson, UNKNOWN_ID) });
    expect(one.statusCode).toBe(401);
  });

  describe("details", () => {
    it("includes the description and tags sorted by name", async () => {
      const lesson = await published({
        name: "Detail",
        description: "Full text",
        tagIds: [b.id, a.id],
      });
      const res = await ctx.app.inject({
        method: "GET",
        url: withId(ApiPaths.lesson, lesson.id),
        cookies,
      });
      expect(res.statusCode).toBe(200);
      const body = LessonDetailSchema.parse(res.json());
      expect(body.description).toBe("Full text");
      expect(body.tags.map((t) => t.name)).toEqual(["Alpha", "Bravo"]);
      expect(body.signature).toEqual(TEST_SIGNATURE);
    });

    it("leaves the signature out of the library list", async () => {
      await published({ name: "Listed", tagIds: [a.id] });
      const res = await list();
      expect(res.statusCode).toBe(200);
      expect(res.json().items[0]).not.toHaveProperty("signature");
    });
    it("404s an unknown id and 400s a malformed one", async () => {
      const unknown = await ctx.app.inject({
        method: "GET",
        url: withId(ApiPaths.lesson, UNKNOWN_ID),
        cookies,
      });
      expect(unknown.statusCode).toBe(404);
      expect(ApiErrorSchema.parse(unknown.json()).error.message).toBe("Lesson not found");
      const bad = await ctx.app.inject({
        method: "GET",
        url: withId(ApiPaths.lesson, "not-a-uuid"),
        cookies,
      });
      expect(bad.statusCode).toBe(400);
      ApiErrorSchema.parse(bad.json());
    });
  });

  it("is listed in the OpenAPI document", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/docs/json" });
    const paths = Object.keys(res.json().paths);
    expect(paths).toContain("/api/lessons");
    expect(paths).toContain("/api/lessons/{id}");
  });
});

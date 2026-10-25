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
import { insertLesson, insertTag, loginCookies } from "../../../test/fixtures";
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

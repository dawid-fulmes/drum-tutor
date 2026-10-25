import { ApiErrorSchema, ApiPaths, pageSchema, TagSchema } from "@drum-tutor/contracts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertTag, loginCookies } from "../../../test/fixtures";
import { createTestApp, resetDatabase } from "../../../test/helpers";

const TagPageSchema = pageSchema(TagSchema);

describe("GET /api/tags", () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let cookies: Record<string, string>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.db);
    cookies = await loginCookies(ctx.app);
  });

  const get = (query = "") =>
    ctx.app.inject({ method: "GET", url: `${ApiPaths.tags}${query}`, cookies });

  it("sorts case-insensitively by name and paginates with correct totals", async () => {
    for (let i = 0; i < 25; i++)
      await insertTag(ctx.db, `${i % 2 ? "b" : "B"}tag ${String(i).padStart(2, "0")}`);
    const res = await get("?pageSize=10&page=3");
    expect(res.statusCode).toBe(200);
    const body = TagPageSchema.parse(res.json());
    expect(body).toMatchObject({ page: 3, pageSize: 10, totalItems: 25, totalPages: 3 });
    expect(body.items).toHaveLength(5);
    const first = TagPageSchema.parse((await get("?pageSize=10")).json());
    expect(first.items.map((t) => t.name)).toEqual(
      first.items.map((t) => t.name).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    );
    expect(first.items[0]?.name.toLowerCase()).toBe("btag 00");
  });

  it("matches q case-insensitively as a substring", async () => {
    await insertTag(ctx.db, "Hand speed");
    await insertTag(ctx.db, "Weak hand");
    await insertTag(ctx.db, "Groove");
    const body = TagPageSchema.parse((await get("?q=HAND")).json());
    expect(body.items.map((t) => t.name)).toEqual(["Hand speed", "Weak hand"]);
  });

  it("treats %, _ and \\ in q literally", async () => {
    await insertTag(ctx.db, "100% wrist");
    await insertTag(ctx.db, "left_hand");
    await insertTag(ctx.db, "back\\slash");
    await insertTag(ctx.db, "Plain");
    const names = async (q: string) =>
      TagPageSchema.parse((await get(`?q=${encodeURIComponent(q)}`)).json()).items.map(
        (t) => t.name,
      );
    expect(await names("%")).toEqual(["100% wrist"]);
    expect(await names("_")).toEqual(["left_hand"]);
    expect(await names("\\")).toEqual(["back\\slash"]);
  });

  it("treats a blank q like no q", async () => {
    await insertTag(ctx.db, "A");
    await insertTag(ctx.db, "B");
    const body = TagPageSchema.parse((await get("?q=%20")).json());
    expect(body.totalItems).toBe(2);
  });

  it("filters by ids, leaving unknown ids out, and combines ids with q as AND", async () => {
    const a = await insertTag(ctx.db, "Alpha");
    const b = await insertTag(ctx.db, "Beta");
    const unknown = "00000000-0000-4000-8000-000000000000";
    const one = TagPageSchema.parse((await get(`?ids=${a.id}&ids=${unknown}`)).json());
    expect(one.items.map((t) => t.id)).toEqual([a.id]);
    expect(one.totalItems).toBe(1);
    const both = TagPageSchema.parse((await get(`?ids=${a.id}&ids=${b.id}`)).json());
    expect(both.items).toHaveLength(2);
    const anded = TagPageSchema.parse((await get(`?ids=${a.id}&ids=${b.id}&q=bet`)).json());
    expect(anded.items.map((t) => t.id)).toEqual([b.id]);
  });

  it("requires a session", async () => {
    const res = await ctx.app.inject({ method: "GET", url: ApiPaths.tags });
    expect(res.statusCode).toBe(401);
  });

  it("rejects pageSize above 100 with VALIDATION_ERROR", async () => {
    const res = await get("?pageSize=101");
    expect(res.statusCode).toBe(400);
    expect(ApiErrorSchema.parse(res.json()).error.code).toBe("VALIDATION_ERROR");
  });
});

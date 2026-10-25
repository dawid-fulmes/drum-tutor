import {
  AdminTagSchema,
  ApiErrorSchema,
  ApiPaths,
  pageSchema,
  withId,
} from "@drum-tutor/contracts";
import { tags } from "@drum-tutor/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertLesson, insertTag, loginCookies } from "../../../test/fixtures";
import { createTestApp, resetDatabase } from "../../../test/helpers";

const AdminTagPageSchema = pageSchema(AdminTagSchema);

describe("admin tag endpoints", () => {
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

  const post = (name: string) =>
    ctx.app.inject({ method: "POST", url: ApiPaths.adminTags, cookies, payload: { name } });
  const patch = (id: string, name: string) =>
    ctx.app.inject({
      method: "PATCH",
      url: withId(ApiPaths.adminTag, id),
      cookies,
      payload: { name },
    });
  const del = (id: string) =>
    ctx.app.inject({ method: "DELETE", url: withId(ApiPaths.adminTag, id), cookies });
  const errorCode = (res: { json(): unknown }) => ApiErrorSchema.parse(res.json()).error.code;

  it("creates a tag with a normalized name and zero lessons", async () => {
    const res = await post("  Weak   hand ");
    expect(res.statusCode).toBe(201);
    expect(AdminTagSchema.parse(res.json())).toMatchObject({ name: "Weak hand", lessonCount: 0 });
  });

  it("rejects a duplicate name in another case with TAG_NAME_TAKEN", async () => {
    await post("  Weak   hand ");
    const res = await post("weak HAND");
    expect(res.statusCode).toBe(409);
    const body = ApiErrorSchema.parse(res.json());
    expect(body.error.code).toBe("TAG_NAME_TAKEN");
    expect(body.error.message).toBe('A tag named "weak HAND" already exists');
  });

  it("lets exactly one of two concurrent creates win", async () => {
    const results = await Promise.all([post("Groove"), post("groove")]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    const loser = results.find((r) => r.statusCode === 409);
    expect(errorCode(loser as { json(): unknown })).toBe("TAG_NAME_TAKEN");
  });

  it("validates the name on create", async () => {
    const res = await post("   ");
    expect(res.statusCode).toBe(400);
    expect(ApiErrorSchema.parse(res.json()).error.details?.[0]?.message).toBe(
      "Tag name is required",
    );
  });

  it("renames, allows a new casing of its own name, and rejects another tag's name", async () => {
    const own = await insertTag(ctx.db, "Weak hand");
    await insertTag(ctx.db, "Groove");
    const taken = await patch(own.id, "GROOVE");
    expect(taken.statusCode).toBe(409);
    expect(errorCode(taken)).toBe("TAG_NAME_TAKEN");
    const recased = await patch(own.id, "WEAK HAND");
    expect(recased.statusCode).toBe(200);
    expect(AdminTagSchema.parse(recased.json()).name).toBe("WEAK HAND");
  });

  it("returns 404 for an unknown id and 400 for a malformed id on PATCH", async () => {
    const unknown = await patch("00000000-0000-4000-8000-000000000000", "X");
    expect(unknown.statusCode).toBe(404);
    expect(ApiErrorSchema.parse(unknown.json()).error.message).toBe("Tag not found");
    const malformed = await patch("not-a-uuid", "X");
    expect(malformed.statusCode).toBe(400);
    expect(errorCode(malformed)).toBe("VALIDATION_ERROR");
  });

  it("deletes an unused tag", async () => {
    const tag = await insertTag(ctx.db, "Temp");
    const res = await del(tag.id);
    expect(res.statusCode).toBe(204);
    expect(await ctx.db.select().from(tags).where(eq(tags.id, tag.id))).toHaveLength(0);
  });

  it("refuses to delete a tag used only by a draft", async () => {
    const tag = await insertTag(ctx.db, "Used");
    await insertLesson(ctx.db, { tagIds: [tag.id], status: "draft" });
    const res = await del(tag.id);
    expect(res.statusCode).toBe(409);
    const body = ApiErrorSchema.parse(res.json());
    expect(body.error.code).toBe("TAG_IN_USE");
    expect(body.error.message).toBe("This tag is used by lessons and can't be deleted");
    expect(await ctx.db.select().from(tags).where(eq(tags.id, tag.id))).toHaveLength(1);
  });

  it("returns 404 deleting an unknown tag and 400 for a malformed id", async () => {
    expect((await del("00000000-0000-4000-8000-000000000000")).statusCode).toBe(404);
    expect((await del("not-a-uuid")).statusCode).toBe(400);
  });

  it("lists tags with lessonCount counting drafts and published lessons", async () => {
    const used = await insertTag(ctx.db, "Used");
    await insertTag(ctx.db, "Unused");
    await insertLesson(ctx.db, { tagIds: [used.id], status: "draft" });
    await insertLesson(ctx.db, { tagIds: [used.id], status: "published" });
    const res = await ctx.app.inject({ method: "GET", url: ApiPaths.adminTags, cookies });
    expect(res.statusCode).toBe(200);
    const body = AdminTagPageSchema.parse(res.json());
    expect(body.items.map((t) => [t.name, t.lessonCount])).toEqual([
      ["Unused", 0],
      ["Used", 2],
    ]);
    expect(body.totalItems).toBe(2);
  });

  it("requires a session on every admin tag route", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    const calls = [
      ctx.app.inject({ method: "GET", url: ApiPaths.adminTags }),
      ctx.app.inject({ method: "POST", url: ApiPaths.adminTags, payload: { name: "x" } }),
      ctx.app.inject({
        method: "PATCH",
        url: withId(ApiPaths.adminTag, id),
        payload: { name: "x" },
      }),
      ctx.app.inject({ method: "DELETE", url: withId(ApiPaths.adminTag, id) }),
    ];
    for (const res of await Promise.all(calls)) expect(res.statusCode).toBe(401);
  });

  it("lists the tag paths in the OpenAPI document", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/docs/json" });
    expect(res.statusCode).toBe(200);
    const paths = Object.keys((res.json() as { paths: Record<string, unknown> }).paths);
    expect(paths).toEqual(
      expect.arrayContaining(["/api/tags", "/api/admin/tags", "/api/admin/tags/{id}"]),
    );
  });
});

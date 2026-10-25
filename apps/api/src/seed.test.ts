import {
  AdminLessonSummarySchema,
  AdminTagSchema,
  ApiPaths,
  LessonSummarySchema,
  pageSchema,
} from "@drum-tutor/contracts";
import { seedDatabase, users } from "@drum-tutor/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loginCookies } from "../test/fixtures";
import { createTestApp, resetDatabase } from "../test/helpers";

describe("seedDatabase", () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let cookies: Record<string, string>;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.db);
    cookies = await loginCookies(ctx.app, "existing@example.com");
  });
  afterAll(async () => {
    await ctx.close();
  });

  const get = async (url: string) => {
    const res = await ctx.app.inject({ method: "GET", url, cookies });
    expect(res.statusCode).toBe(200);
    return res.json();
  };

  const check = async () => {
    const library = pageSchema(LessonSummarySchema).parse(
      await get(`${ApiPaths.lessons}?pageSize=12`),
    );
    expect(library.totalItems).toBe(15);
    expect(library.totalPages).toBe(2);
    const publishedAll = pageSchema(LessonSummarySchema).parse(
      await get(`${ApiPaths.lessons}?pageSize=100`),
    );
    expect(new Set(publishedAll.items.map((i) => i.difficulty))).toEqual(
      new Set(["beginner", "intermediate", "advanced"]),
    );

    const admin = pageSchema(AdminLessonSummarySchema).parse(
      await get(`${ApiPaths.adminLessons}?pageSize=100`),
    );
    expect(admin.items).toHaveLength(18);
    expect(admin.items.filter((i) => i.status === "draft")).toHaveLength(3);
    const locked = admin.items.filter((i) => i.locked);
    expect(locked).toHaveLength(1);
    expect(locked[0]?.status).toBe("published");
    for (const item of admin.items) {
      expect(item.tags.length).toBeGreaterThanOrEqual(1);
      expect(item.tags.length).toBeLessThanOrEqual(3);
    }

    const tagPage = pageSchema(AdminTagSchema).parse(
      await get(`${ApiPaths.adminTags}?pageSize=100`),
    );
    expect(tagPage.items.map((t) => t.name).sort()).toEqual(
      ["Groove", "Hand speed", "Hi-hat foot", "Kick drum foot", "Rudiments", "Weak hand"].sort(),
    );
  };

  it("loads the dataset, keeps users and is repeatable", async () => {
    await seedDatabase(ctx.db);
    await check();
    await seedDatabase(ctx.db);
    await check();
    const [existing] = await ctx.db
      .select()
      .from(users)
      .where(eq(users.email, "existing@example.com"));
    expect(existing).toBeDefined();
    const [seedUser] = await ctx.db.select().from(users).where(eq(users.email, "seed@example.com"));
    expect(seedUser).toBeDefined();
  });
});

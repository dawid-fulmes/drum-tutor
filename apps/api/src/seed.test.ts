import {
  AdminLessonSummarySchema,
  AdminTagSchema,
  ApiPaths,
  DailyStatsSchema,
  LessonSummarySchema,
  pageSchema,
  WeeklyStatsSchema,
} from "@drum-tutor/contracts";
import { seedDatabase, users } from "@drum-tutor/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loginCookies } from "../test/fixtures";
import { createTestApp, resetDatabase } from "../test/helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

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
    // Three published lessons carry the seed user's year of practice (spec §4 "Seed").
    const locked = admin.items.filter((i) => i.locked);
    expect(locked).toHaveLength(3);
    expect(locked.every((i) => i.status === "published")).toBe(true);
    expect(new Set(locked.flatMap((i) => i.tags.map((t) => t.name))).size).toBeGreaterThanOrEqual(
      4,
    );
    const thirteenMonthsAgo = new Date();
    thirteenMonthsAgo.setUTCMonth(thirteenMonthsAgo.getUTCMonth() - 13);
    const thirtyOneDaysAgo = Date.now() - 31 * DAY_MS;
    for (const item of admin.items) {
      const createdAt = new Date(item.createdAt).getTime();
      if (item.locked) expect(createdAt).toBeLessThan(thirteenMonthsAgo.getTime());
      else expect(createdAt).toBeGreaterThan(thirtyOneDaysAgo);
    }
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

    await checkSeedUserStats(locked[0]?.tags[0]?.id as string);
  };

  const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

  const checkSeedUserStats = async (tagId: string) => {
    const seedCookies = await loginCookies(ctx.app, "seed@example.com");
    const statsGet = async (path: string, from: string, to: string) => {
      const res = await ctx.app.inject({
        method: "GET",
        url: `${path}?tagId=${tagId}&from=${from}&to=${to}`,
        cookies: seedCookies,
      });
      expect(res.statusCode).toBe(200);
      return res.json();
    };
    // The last four weeks and the same four weeks a year earlier both show practice and rest days.
    const yesterday = Date.now() - DAY_MS;
    for (const end of [yesterday, yesterday - 364 * DAY_MS]) {
      const stats = DailyStatsSchema.parse(
        await statsGet(ApiPaths.statsDaily, isoDate(end - 27 * DAY_MS), isoDate(end)),
      );
      expect(stats.days.some((d) => d.seconds > 0)).toBe(true);
      expect(stats.days.some((d) => d.seconds === 0)).toBe(true);
    }
    const lastYear = new Date().getUTCFullYear() - 1;
    const weekly = WeeklyStatsSchema.parse(
      await statsGet(ApiPaths.statsWeekly, `${lastYear}-01-01`, `${lastYear}-12-31`),
    );
    expect(weekly.weeks.reduce((sum, w) => sum + w.seconds, 0)).toBeGreaterThan(0);
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

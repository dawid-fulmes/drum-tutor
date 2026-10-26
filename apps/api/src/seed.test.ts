import {
  AdminLessonSchema,
  AdminLessonSummarySchema,
  AdminTagSchema,
  ApiPaths,
  DailyStatsSchema,
  LessonDetailSchema,
  type LessonSummary,
  LessonSummarySchema,
  pageSchema,
  type Signature,
  signatureHasNotes,
  WeeklyStatsSchema,
  withId,
} from "@drum-tutor/contracts";
import { seedDatabase, users } from "@drum-tutor/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loginCookies } from "../test/fixtures";
import { createTestApp, resetDatabase } from "../test/helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

// Spec rating §5.3, in the expected library order.
const RATED = [
  { name: "Four on the floor", average: 4.67, count: 6 },
  { name: "Money beat", average: 4.6, count: 5 },
  { name: "Single strokes on a pad", average: 4.5, count: 6 },
  { name: "Double strokes", average: 4.5, count: 2 },
  { name: "Single paradiddles", average: 4, count: 4 },
  { name: "Disco offbeat hi-hat", average: 4, count: 1 },
  { name: "Weak hand eighth notes", average: 3.33, count: 3 },
  { name: "Quarter-note kick control", average: 2.5, count: 2 },
] as const;

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
    // Eight published lessons have practice logs: the seed user's three and the raters' (spec rating §5.3).
    const locked = admin.items.filter((i) => i.locked);
    expect(locked).toHaveLength(8);
    expect(locked.every((i) => i.status === "published")).toBe(true);
    expect(new Set(locked.flatMap((i) => i.tags.map((t) => t.name))).size).toBeGreaterThanOrEqual(
      4,
    );
    const seedUserLessons = ["Money beat", "Single paradiddles", "Weak hand eighth notes"];
    const thirteenMonthsAgo = new Date();
    thirteenMonthsAgo.setUTCMonth(thirteenMonthsAgo.getUTCMonth() - 13);
    const thirtyOneDaysAgo = Date.now() - 31 * DAY_MS;
    for (const item of admin.items) {
      const createdAt = new Date(item.createdAt).getTime();
      if (seedUserLessons.includes(item.name)) {
        expect(createdAt).toBeLessThan(thirteenMonthsAgo.getTime());
      } else expect(createdAt).toBeGreaterThan(thirtyOneDaysAgo);
    }
    for (const item of admin.items) {
      expect(item.tags.length).toBeGreaterThanOrEqual(1);
      expect(item.tags.length).toBeLessThanOrEqual(3);
    }

    expect(locked.map((i) => i.name).sort()).toEqual([...RATED.map((r) => r.name)].sort());
    await checkRatings(publishedAll.items);
    await checkSignatures(admin.items.map((i) => i.id));

    const tagPage = pageSchema(AdminTagSchema).parse(
      await get(`${ApiPaths.adminTags}?pageSize=100`),
    );
    expect(tagPage.items.map((t) => t.name).sort()).toEqual(
      ["Groove", "Hand speed", "Hi-hat foot", "Kick drum foot", "Rudiments", "Weak hand"].sort(),
    );

    await checkSeedUserStats(locked[0]?.tags[0]?.id as string);
  };

  const checkRatings = async (items: LessonSummary[]) => {
    expect(items.slice(0, 8).map((i) => ({ name: i.name, ...i.rating }))).toEqual(
      RATED.map((r) => ({ name: r.name, average: r.average, count: r.count })),
    );
    const unrated = items.slice(8);
    expect(unrated).toHaveLength(7);
    for (const item of unrated) expect(item.rating).toEqual({ average: null, count: 0 });
    const times = unrated.map((i) => new Date(i.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));

    const seedCookies = await loginCookies(ctx.app, "seed@example.com");
    const idOf = (name: string) => items.find((i) => i.name === name)?.id as string;
    const detail = async (name: string) => {
      const res = await ctx.app.inject({
        method: "GET",
        url: withId(ApiPaths.lesson, idOf(name)),
        cookies: seedCookies,
      });
      expect(res.statusCode).toBe(200);
      return LessonDetailSchema.parse(res.json());
    };
    expect(await detail("Money beat")).toMatchObject({ myRating: 5, canRate: true });
    expect(await detail("Single paradiddles")).toMatchObject({ myRating: 4 });
    expect(await detail("Weak hand eighth notes")).toMatchObject({ myRating: null, canRate: true });
    expect(await detail("Four on the floor")).toMatchObject({ myRating: null, canRate: false });

    // R3 in the seed data: every rating has a log of the same user and lesson.
    const orphans = await ctx.db.execute(sql`
      select 1 from lesson_ratings r
      where not exists (
        select 1 from practice_logs p where p.user_id = r.user_id and p.lesson_id = r.lesson_id
      )
    `);
    expect(orphans.rows).toHaveLength(0);
    // The stored aggregate equals the recompute for every lesson.
    const drift = await ctx.db.execute(sql`
      select l.id from lessons l
      where l.rating_count <> (select count(*) from lesson_ratings r where r.lesson_id = l.id)
         or l.rating_avg is distinct from (
           select round(avg(r.rating), 2) from lesson_ratings r where r.lesson_id = l.id
         )
    `);
    expect(drift.rows).toHaveLength(0);
  };

  const INSTRUMENT_CODES = { "hihat-closed": "H", snare: "S", kick: "K" } as const;
  /** The spec §5.1 grid notation of a signature's instruments, e.g. "HK H HS H …". */
  const grid = (signature: Signature) =>
    signature.slots
      .map((slot) =>
        slot.instruments.length === 0
          ? "-"
          : slot.instruments
              .map((i) => INSTRUMENT_CODES[i])
              .sort()
              .join(""),
      )
      .join(" ");

  // Every stored signature passes the contract, and every published lesson has notes (ADR-0053).
  const checkSignatures = async (ids: string[]) => {
    const lessons = await Promise.all(
      ids.map(async (id) => AdminLessonSchema.parse(await get(withId(ApiPaths.adminLesson, id)))),
    );
    const byName = new Map(lessons.map((l) => [l.name, l]));
    for (const lesson of lessons) {
      if (lesson.status === "published") expect(signatureHasNotes(lesson.signature)).toBe(true);
    }
    const hihatChicks = byName.get("Hi-hat foot chicks on 2&4");
    expect(hihatChicks?.status).toBe("draft");
    expect(signatureHasNotes(hihatChicks?.signature as Signature)).toBe(false);
    const sorted = (cells: string) =>
      cells
        .split(" ")
        .map((cell) => [...cell].sort().join(""))
        .join(" ");
    expect(grid(byName.get("Money beat")?.signature as Signature)).toBe(
      sorted("HK H HS H HK H HS H"),
    );
    expect(byName.get("Single strokes on a pad")?.signature.slots.map((s) => s.comment)).toEqual([
      "R",
      "L",
      "R",
      "L",
      "R",
      "L",
      "R",
      "L",
    ]);
    for (const dropped of [
      "Sixteenth-note hi-hat groove",
      "Triplet fill around the toms",
      "Flam taps",
    ]) {
      expect(byName.has(dropped)).toBe(false);
    }
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

import {
  ApiErrorSchema,
  ApiPaths,
  DailyStatsSchema,
  WeeklyStatsSchema,
} from "@drum-tutor/contracts";
import type { LessonRow, TagRow } from "@drum-tutor/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  insertLesson,
  insertPracticeLog,
  insertTag,
  insertUser,
  loginCookies,
} from "../../../test/fixtures";
import { createTestApp, resetDatabase } from "../../../test/helpers";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const USER_EMAIL = "drummer@example.com";

describe("stats endpoints", () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let cookies: Record<string, string>;
  let userId: string;
  let tagA: TagRow;
  let tagB: TagRow;
  let tagC: TagRow;
  let lessonAB: LessonRow;
  let lessonA: LessonRow;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.db);
    cookies = await loginCookies(ctx.app, USER_EMAIL);
    userId = (await insertUser(ctx.db, USER_EMAIL)).id;
    tagA = await insertTag(ctx.db, "Hand speed");
    tagB = await insertTag(ctx.db, "Weak hand");
    tagC = await insertTag(ctx.db, "Kick drum foot");
    lessonAB = await insertLesson(ctx.db, { status: "published", tagIds: [tagA.id, tagB.id] });
    lessonA = await insertLesson(ctx.db, { status: "published", tagIds: [tagA.id] });
  });

  const log = (lessonId: string, localDate: string, durationSeconds = 300, owner = userId) =>
    insertPracticeLog(ctx.db, lessonId, {
      userId: owner,
      localDate,
      durationSeconds,
      completedAt: new Date(`${localDate}T12:00:00Z`),
    });
  const get = (path: string, tagId: string, from: string, to: string, as = cookies) =>
    ctx.app.inject({
      method: "GET",
      url: `${path}?tagId=${tagId}&from=${from}&to=${to}`,
      cookies: as,
    });
  const daily = async (tagId: string, from: string, to: string) => {
    const res = await get(ApiPaths.statsDaily, tagId, from, to);
    expect(res.statusCode).toBe(200);
    return DailyStatsSchema.parse(res.json());
  };
  const weekly = async (tagId: string, from: string, to: string) => {
    const res = await get(ApiPaths.statsWeekly, tagId, from, to);
    expect(res.statusCode).toBe(200);
    return WeeklyStatsSchema.parse(res.json());
  };
  const secondsOn = (stats: { days: { date: string; seconds: number }[] }, date: string) =>
    stats.days.find((d) => d.date === date)?.seconds;

  describe("daily", () => {
    it("returns every day of the range as a date string with numeric seconds", async () => {
      await log(lessonA.id, "2026-10-03", 600);
      const stats = await daily(tagA.id, "2026-10-01", "2026-10-07");
      expect(stats).toMatchObject({ tagId: tagA.id, from: "2026-10-01", to: "2026-10-07" });
      expect(stats.days.map((d) => d.date)).toEqual([
        "2026-10-01",
        "2026-10-02",
        "2026-10-03",
        "2026-10-04",
        "2026-10-05",
        "2026-10-06",
        "2026-10-07",
      ]);
      expect(stats.days.map((d) => d.seconds)).toEqual([0, 0, 600, 0, 0, 0, 0]);
      for (const day of stats.days) expect(typeof day.seconds).toBe("number");
    });

    it("counts a multi-tag lesson once per tag and never for other tags", async () => {
      await log(lessonAB.id, "2026-10-02", 300);
      expect(secondsOn(await daily(tagA.id, "2026-10-01", "2026-10-07"), "2026-10-02")).toBe(300);
      expect(secondsOn(await daily(tagB.id, "2026-10-01", "2026-10-07"), "2026-10-02")).toBe(300);
      const other = await daily(tagC.id, "2026-10-01", "2026-10-07");
      expect(other.days.every((d) => d.seconds === 0)).toBe(true);
    });

    it("sums two lessons with the tag on the same day", async () => {
      await log(lessonAB.id, "2026-10-02", 300);
      await log(lessonA.id, "2026-10-02", 600);
      expect(secondsOn(await daily(tagA.id, "2026-10-01", "2026-10-07"), "2026-10-02")).toBe(900);
    });

    it("ignores other users' logs", async () => {
      const other = await insertUser(ctx.db, "other@example.com");
      await log(lessonA.id, "2026-10-02", 300, other.id);
      const stats = await daily(tagA.id, "2026-10-01", "2026-10-07");
      expect(stats.days.every((d) => d.seconds === 0)).toBe(true);
    });

    it("buckets by the stored local date, not the UTC completion time", async () => {
      await insertPracticeLog(ctx.db, lessonA.id, {
        userId,
        localDate: "2026-10-06",
        completedAt: new Date("2026-10-05T23:30:00Z"),
        durationSeconds: 300,
      });
      const stats = await daily(tagA.id, "2026-10-01", "2026-10-07");
      expect(secondsOn(stats, "2026-10-05")).toBe(0);
      expect(secondsOn(stats, "2026-10-06")).toBe(300);
    });

    it("accepts 31 days and rejects 32, from after to and impossible dates", async () => {
      expect((await daily(tagA.id, "2026-10-01", "2026-10-31")).days).toHaveLength(31);
      for (const [from, to] of [
        ["2026-10-01", "2026-11-01"],
        ["2026-10-02", "2026-10-01"],
        ["2026-13-01", "2026-13-02"],
      ] as const) {
        const res = await get(ApiPaths.statsDaily, tagA.id, from, to);
        expect(res.statusCode).toBe(400);
        expect(res.json().error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("returns 404 for an unknown tag and 401 without a session", async () => {
      const unknown = await get(ApiPaths.statsDaily, UNKNOWN_ID, "2026-10-01", "2026-10-07");
      expect(unknown.statusCode).toBe(404);
      expect(ApiErrorSchema.parse(unknown.json()).error).toMatchObject({
        code: "NOT_FOUND",
        message: "Tag not found",
      });
      const anonymous = await get(ApiPaths.statsDaily, tagA.id, "2026-10-01", "2026-10-07", {});
      expect(anonymous.statusCode).toBe(401);
    });
  });

  describe("weekly", () => {
    it("returns Monday–Sunday weeks clipped to the year", async () => {
      const stats = await weekly(tagA.id, "2026-01-01", "2026-12-31");
      expect(stats.weeks).toHaveLength(53);
      expect(stats.weeks[0]).toEqual({ from: "2026-01-01", to: "2026-01-04", seconds: 0 });
      expect(stats.weeks[1]?.from).toBe("2026-01-05");
      expect(stats.weeks[1]?.to).toBe("2026-01-11");
      expect(stats.weeks.at(-1)).toEqual({ from: "2026-12-28", to: "2026-12-31", seconds: 0 });
      for (const week of stats.weeks) expect(typeof week.seconds).toBe("number");
    });

    it("puts Sunday and the next Monday in different weeks", async () => {
      await log(lessonA.id, "2026-10-25", 300); // Sunday
      await log(lessonA.id, "2026-10-26", 600); // Monday
      const stats = await weekly(tagA.id, "2026-01-01", "2026-12-31");
      expect(stats.weeks.find((w) => w.from === "2026-10-19")?.seconds).toBe(300);
      expect(stats.weeks.find((w) => w.from === "2026-10-26")?.seconds).toBe(600);
    });

    it("counts only the clipped days of the first week", async () => {
      await log(lessonA.id, "2025-12-31", 300); // same ISO week as 2026-01-01, outside the range
      await log(lessonA.id, "2026-01-02", 600);
      const stats = await weekly(tagA.id, "2026-01-01", "2026-12-31");
      expect(stats.weeks[0]?.seconds).toBe(600);
    });

    it("accepts 366 days and rejects 367", async () => {
      expect((await weekly(tagA.id, "2024-01-01", "2024-12-31")).weeks.length).toBeGreaterThan(0);
      const res = await get(ApiPaths.statsWeekly, tagA.id, "2024-01-01", "2025-01-01");
      expect(res.statusCode).toBe(400);
    });

    it("returns 404 for an unknown tag", async () => {
      const res = await get(ApiPaths.statsWeekly, UNKNOWN_ID, "2026-01-01", "2026-12-31");
      expect(res.statusCode).toBe(404);
    });
  });

  it("lists both paths in the OpenAPI document", async () => {
    const res = await ctx.app.inject({ method: "GET", url: `${ApiPaths.docs}/json` });
    const paths = Object.keys(res.json().paths);
    expect(paths).toContain(ApiPaths.statsDaily);
    expect(paths).toContain(ApiPaths.statsWeekly);
  });
});

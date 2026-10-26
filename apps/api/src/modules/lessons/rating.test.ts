import { randomUUID } from "node:crypto";
import {
  ApiErrorSchema,
  ApiPaths,
  LessonDetailSchema,
  LessonRatingSchema,
  type PracticeLogInput,
  withId,
} from "@drum-tutor/contracts";
import { type LessonRow, practiceLogs, type TagRow } from "@drum-tutor/db";
import { sql } from "drizzle-orm";
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
const RATING_MESSAGE = "Choose a rating from 1 to 5";

describe("PUT /api/lessons/:id/rating", () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let cookies: Record<string, string>;
  let tag: TagRow;
  let lesson: LessonRow;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.db);
    cookies = await loginCookies(ctx.app);
    tag = await insertTag(ctx.db, "Groove");
    lesson = await published();
  });

  const published = () => insertLesson(ctx.db, { status: "published", tagIds: [tag.id] });
  const userId = async (email = "user@example.com") => (await insertUser(ctx.db, email)).id;
  const logFor = async (lessonId: string, email = "user@example.com") =>
    insertPracticeLog(ctx.db, lessonId, { userId: await userId(email) });
  const rate = (lessonId: string, payload: unknown, as: Record<string, string> = cookies) =>
    ctx.app.inject({
      method: "PUT",
      url: withId(ApiPaths.lessonRating, lessonId),
      cookies: as,
      payload: payload as object,
    });
  const ratingRows = async (lessonId: string) =>
    (
      await ctx.db.execute<{ user_id: string; rating: number; created_at: Date; updated_at: Date }>(
        sql`select user_id, rating, created_at, updated_at from lesson_ratings where lesson_id = ${lessonId}`,
      )
    ).rows;
  const storedCount = async (lessonId: string) =>
    (
      await ctx.db.execute<{ rating_count: number }>(
        sql`select rating_count from lessons where id = ${lessonId}`,
      )
    ).rows[0]?.rating_count;

  /** The stored aggregate equals a fresh count/average over `lesson_ratings` (ADR-0055). */
  const consistent = async (lessonId: string) => {
    const { rows } = await ctx.db.execute<{
      rating_count: number;
      rating_avg: string | null;
      count: number;
      avg: string | null;
    }>(sql`
      select l.rating_count, l.rating_avg, s.count, s.avg
      from lessons l,
        (select count(*)::int as count, round(avg(rating), 2) as avg
         from lesson_ratings where lesson_id = ${lessonId}) s
      where l.id = ${lessonId}
    `);
    const [row] = rows;
    expect(row).toBeDefined();
    expect(row?.rating_count).toBe(row?.count);
    expect(row?.rating_avg).toBe(row?.avg);
  };

  it("refuses a rating before the lesson was completed", async () => {
    const res = await rate(lesson.id, { rating: 4 });
    expect(res.statusCode).toBe(409);
    expect(ApiErrorSchema.parse(res.json()).error).toMatchObject({
      code: "RATING_REQUIRES_COMPLETION",
      message: "Complete this lesson once before rating it",
    });
    expect(await ratingRows(lesson.id)).toHaveLength(0);
    expect(await storedCount(lesson.id)).toBe(0);
    await consistent(lesson.id);
  });

  it("rates a completed lesson and shows the rating on the detail", async () => {
    await logFor(lesson.id);
    const res = await rate(lesson.id, { rating: 4 });
    expect(res.statusCode).toBe(200);
    expect(LessonRatingSchema.parse(res.json())).toEqual({
      rating: { average: 4, count: 1 },
      myRating: 4,
    });
    await consistent(lesson.id);

    const detail = await ctx.app.inject({
      method: "GET",
      url: withId(ApiPaths.lesson, lesson.id),
      cookies,
    });
    expect(detail.statusCode).toBe(200);
    expect(LessonDetailSchema.parse(detail.json())).toMatchObject({
      myRating: 4,
      canRate: true,
      rating: { average: 4, count: 1 },
    });
  });

  it("replaces the rating when written again", async () => {
    await logFor(lesson.id);
    expect((await rate(lesson.id, { rating: 4 })).statusCode).toBe(200);
    const res = await rate(lesson.id, { rating: 2 });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ rating: { average: 2, count: 1 }, myRating: 2 });
    const rows = await ratingRows(lesson.id);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    if (!row) throw new Error("missing rating row");
    expect(row.rating).toBe(2);
    // Compared in SQL: node-pg truncates timestamps to milliseconds.
    const { rows: later } = await ctx.db.execute<{ later: boolean }>(
      sql`select updated_at > created_at as later from lesson_ratings where lesson_id = ${lesson.id}`,
    );
    expect(later[0]?.later).toBe(true);
    await consistent(lesson.id);
  });

  it("accepts the same value again with an unchanged summary", async () => {
    await logFor(lesson.id);
    const first = await rate(lesson.id, { rating: 3 });
    const second = await rate(lesson.id, { rating: 3 });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(second.json()).toEqual({ rating: { average: 3, count: 1 }, myRating: 3 });
    expect(await ratingRows(lesson.id)).toHaveLength(1);
    await consistent(lesson.id);
  });

  it("averages several users' ratings to two decimals", async () => {
    let last: Awaited<ReturnType<typeof rate>> | undefined;
    for (const [i, value] of [5, 4, 4].entries()) {
      const email = `rater${i}@example.com`;
      const as = await loginCookies(ctx.app, email);
      await logFor(lesson.id, email);
      last = await rate(lesson.id, { rating: value }, as);
      expect(last.statusCode).toBe(200);
      await consistent(lesson.id);
    }
    expect(last?.json()).toEqual({ rating: { average: 4.33, count: 3 }, myRating: 4 });
  });

  it("404s a draft lesson even with a log", async () => {
    const draft = await insertLesson(ctx.db, { tagIds: [tag.id] });
    await logFor(draft.id);
    const res = await rate(draft.id, { rating: 4 });
    expect(res.statusCode).toBe(404);
    expect(ApiErrorSchema.parse(res.json()).error).toMatchObject({
      code: "NOT_FOUND",
      message: "Lesson not found",
    });
    expect(await ratingRows(draft.id)).toHaveLength(0);
    await consistent(draft.id);
  });

  it("404s an unknown id and 400s a malformed one", async () => {
    const unknown = await rate(UNKNOWN_ID, { rating: 4 });
    expect(unknown.statusCode).toBe(404);
    expect(ApiErrorSchema.parse(unknown.json()).error.message).toBe("Lesson not found");
    const bad = await rate("not-a-uuid", { rating: 4 });
    expect(bad.statusCode).toBe(400);
    expect(ApiErrorSchema.parse(bad.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it.each([{ rating: 6 }, { rating: 0 }, { rating: 3.5 }, { rating: "4" }, {}])(
    "rejects the body %j with 400",
    async (payload) => {
      await logFor(lesson.id);
      const res = await rate(lesson.id, payload);
      expect(res.statusCode).toBe(400);
      const { error } = ApiErrorSchema.parse(res.json());
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toContainEqual({ path: "rating", message: RATING_MESSAGE });
      expect(await ratingRows(lesson.id)).toHaveLength(0);
    },
  );

  it("requires a session", async () => {
    expect((await rate(lesson.id, { rating: 4 }, {})).statusCode).toBe(401);
  });

  it("has no DELETE route (ADR-0056)", async () => {
    await logFor(lesson.id);
    expect((await rate(lesson.id, { rating: 4 })).statusCode).toBe(200);
    const res = await ctx.app.inject({
      method: "DELETE",
      url: withId(ApiPaths.lessonRating, lesson.id),
      cookies,
    });
    expect(res.statusCode).toBe(404);
    expect(ApiErrorSchema.parse(res.json()).error).toEqual({
      code: "NOT_FOUND",
      message: "Not found",
    });
    expect(await ratingRows(lesson.id)).toHaveLength(1);
  });

  describe("concurrency", () => {
    it("keeps the count exact when 20 users rate one lesson at once (Review Focus 1)", async () => {
      const raters = await Promise.all(
        Array.from({ length: 20 }, async (_, i) => {
          const email = `crowd${i}@example.com`;
          return { email, cookies: await loginCookies(ctx.app, email) };
        }),
      );
      for (let round = 0; round < 5; round++) {
        const target = await published();
        for (const r of raters) await logFor(target.id, r.email);
        const responses = await Promise.all(
          raters.map((r, i) => rate(target.id, { rating: 1 + (i % 5) }, r.cookies)),
        );
        expect(responses.map((res) => res.statusCode)).toEqual(raters.map(() => 200));
        expect(await storedCount(target.id)).toBe(20);
        expect(await ratingRows(target.id)).toHaveLength(20);
        await consistent(target.id);
      }
    });

    it("keeps one row when a user submits two values at once (Review Focus 2)", async () => {
      for (let round = 0; round < 10; round++) {
        const target = await published();
        await logFor(target.id);
        const responses = await Promise.all([
          rate(target.id, { rating: 2 }),
          rate(target.id, { rating: 5 }),
        ]);
        expect(responses.map((res) => res.statusCode)).toEqual([200, 200]);
        const rows = await ratingRows(target.id);
        expect(rows).toHaveLength(1);
        expect([2, 5]).toContain(rows[0]?.rating);
        await consistent(target.id);
      }
    });

    it("answers 200 or 409 when the first log races the rating (Review Focus 3)", async () => {
      for (let round = 0; round < 10; round++) {
        const email = `racer${round}@example.com`;
        const as = await loginCookies(ctx.app, email);
        const today = new Date().toISOString().slice(0, 10);
        const log: PracticeLogInput = {
          idempotencyKey: randomUUID(),
          lessonId: lesson.id,
          durationSeconds: 300,
          tempoBpm: 90,
          completedAt: new Date(Date.now() - 60_000).toISOString(),
          localDate: today,
        };
        const [logRes, rateRes] = await Promise.all([
          ctx.app.inject({ method: "POST", url: ApiPaths.practiceLogs, cookies: as, payload: log }),
          rate(lesson.id, { rating: 4 }, as),
        ]);
        expect(logRes.statusCode).toBe(201);
        expect([200, 409]).toContain(rateRes.statusCode);
        if (rateRes.statusCode === 409) {
          expect(rateRes.json().error.code).toBe("RATING_REQUIRES_COMPLETION");
        }
        await consistent(lesson.id);
      }
    });

    // The race above almost always lets the rating run first (409); this pins the other branch.
    it("waits for a first log being saved, then accepts the rating (Review Focus 3)", async () => {
      const uid = await userId();
      let pending: ReturnType<typeof rate> | undefined;
      await ctx.db.transaction(async (tx) => {
        // What the practice-log write does: FOR SHARE on the lesson, then the insert.
        await tx.execute(sql`select id from lessons where id = ${lesson.id} for share`);
        await tx.insert(practiceLogs).values({
          userId: uid,
          lessonId: lesson.id,
          durationSeconds: 180,
          tempoBpm: 60,
          completedAt: new Date(),
          localDate: new Date().toISOString().slice(0, 10),
          idempotencyKey: randomUUID(),
        });
        pending = rate(lesson.id, { rating: 4 });
        await untilSomeoneWaitsOnALock();
      });
      if (!pending) throw new Error("rating request was not sent");
      const res = await pending;
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ rating: { average: 4, count: 1 }, myRating: 4 });
      await consistent(lesson.id);
    });
  });

  const untilSomeoneWaitsOnALock = async () => {
    for (let attempt = 0; attempt < 500; attempt++) {
      const { rows } = await ctx.db.execute<{ waiting: number }>(sql`
        select count(*)::int as waiting from pg_stat_activity
        where datname = current_database() and wait_event_type = 'Lock'
      `);
      if ((rows[0]?.waiting ?? 0) > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("The rating request never waited for the lesson lock");
  };

  it("is listed in the OpenAPI document", async () => {
    const res = await ctx.app.inject({ method: "GET", url: `${ApiPaths.docs}/json` });
    const operation = res.json().paths["/api/lessons/{id}/rating"]?.put;
    expect(operation).toBeDefined();
    expect(Object.keys(operation.responses)).toContain("409");
  });
});

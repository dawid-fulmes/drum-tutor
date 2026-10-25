import { randomUUID } from "node:crypto";
import {
  ApiErrorSchema,
  ApiPaths,
  type LessonInput,
  type PracticeLogInput,
  PracticeLogSchema,
  withId,
} from "@drum-tutor/contracts";
import { type LessonRow, practiceLogs } from "@drum-tutor/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertLesson, insertTag, loginCookies } from "../../../test/fixtures";
import { createTestApp, resetDatabase } from "../../../test/helpers";

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
const MINUTE_MS = 60 * 1000;

describe("POST /api/practice-logs", () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let cookies: Record<string, string>;
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
    const tag = await insertTag(ctx.db, "Groove");
    lesson = await insertLesson(ctx.db, { status: "published", tagIds: [tag.id] });
  });

  // A session that finished a minute ago, in UTC+2.
  const input = (overrides: Partial<PracticeLogInput> = {}): PracticeLogInput => {
    const completed = new Date(Date.now() - MINUTE_MS);
    const local = new Date(completed.getTime() + 2 * 60 * MINUTE_MS);
    return {
      idempotencyKey: randomUUID(),
      lessonId: lesson.id,
      durationSeconds: 300,
      tempoBpm: 90,
      completedAt: `${local.toISOString().slice(0, 19)}+02:00`,
      localDate: local.toISOString().slice(0, 10),
      ...overrides,
    };
  };
  const post = (payload: unknown, as = cookies) =>
    ctx.app.inject({
      method: "POST",
      url: ApiPaths.practiceLogs,
      cookies: as,
      payload: payload as object,
    });
  const rows = () => ctx.db.select().from(practiceLogs);

  it("creates a log with the sent values", async () => {
    const body = input();
    const res = await post(body);
    expect(res.statusCode).toBe(201);
    const log = PracticeLogSchema.parse(res.json());
    expect(log).toMatchObject({
      lessonId: lesson.id,
      durationSeconds: 300,
      tempoBpm: 90,
      completedAt: new Date(body.completedAt).toISOString(),
      localDate: body.localDate,
    });
    const stored = await rows();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      idempotencyKey: body.idempotencyKey,
      localDate: body.localDate,
    });
  });

  it("returns the original log for a repeated key, whatever the body says", async () => {
    const body = input();
    const first = await post(body);
    const again = await post({ ...body, tempoBpm: 120 });
    expect(again.statusCode).toBe(200);
    expect(again.json()).toEqual(first.json());
    expect(await rows()).toHaveLength(1);
  });

  it("stores one row for two concurrent requests with the same key", async () => {
    const body = input();
    const statuses = (await Promise.all([post(body), post(body)])).map((r) => r.statusCode);
    expect(statuses.sort()).toEqual([200, 201]);
    expect(await rows()).toHaveLength(1);
  });

  it("keeps the same key of two users apart", async () => {
    const body = input();
    const other = await loginCookies(ctx.app, "other@example.com");
    expect((await post(body)).statusCode).toBe(201);
    expect((await post(body, other)).statusCode).toBe(201);
    expect(await rows()).toHaveLength(2);
  });

  it("returns 404 for a draft or unknown lesson and stores nothing", async () => {
    const tag = await insertTag(ctx.db, "Rudiments");
    const draft = await insertLesson(ctx.db, { tagIds: [tag.id] });
    for (const lessonId of [draft.id, UNKNOWN_ID]) {
      const res = await post(input({ lessonId }));
      expect(res.statusCode).toBe(404);
      expect(ApiErrorSchema.parse(res.json()).error).toMatchObject({
        code: "NOT_FOUND",
        message: "Lesson not found",
      });
    }
    expect(await rows()).toEqual([]);
  });

  it.each([
    { durationSeconds: 0 },
    { durationSeconds: 15 },
    { durationSeconds: 45 },
    { durationSeconds: 3630 },
    { tempoBpm: 29 },
    { tempoBpm: 301 },
  ])("rejects %j", async (overrides) => {
    const res = await post(input(overrides));
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    { durationSeconds: 30 },
    { durationSeconds: 3600 },
    { tempoBpm: 30 },
    { tempoBpm: 300 },
  ])("accepts boundary %j", async (overrides) => {
    expect((await post(input(overrides))).statusCode).toBe(201);
  });

  it("rejects a completion time 10 minutes in the future and accepts 2 minutes", async () => {
    const at = (offsetMs: number) => {
      const date = new Date(Date.now() + offsetMs);
      return { completedAt: date.toISOString(), localDate: date.toISOString().slice(0, 10) };
    };
    const future = await post(input(at(10 * MINUTE_MS)));
    expect(future.statusCode).toBe(400);
    expect(future.json().error.details).toEqual([
      { path: "completedAt", message: "Completion time can't be in the future" },
    ]);
    expect((await post(input(at(2 * MINUTE_MS)))).statusCode).toBe(201);
  });

  it("checks the local date against the completion time", async () => {
    const completedAt = "2026-10-25T21:30:00+02:00";
    const twoDaysOff = await post(input({ completedAt, localDate: "2026-10-27" }));
    expect(twoDaysOff.statusCode).toBe(400);
    expect(twoDaysOff.json().error.details).toContainEqual({
      path: "localDate",
      message: "Local date must be within one day of the completion time",
    });
    expect((await post(input({ completedAt, localDate: "2026-10-26" }))).statusCode).toBe(201);
  });

  it("rejects an impossible local date with 400", async () => {
    const res = await post(input({ localDate: "2026-02-30" }));
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it.each([
    ["0000-01-01T00:00:00Z", "1900-01-01"],
    ["0000-01-01T00:00:00+01:00", "1900-01-12"],
  ])("rejects completion time %s with 400, not 500", async (completedAt, localDate) => {
    const res = await post(input({ completedAt, localDate }));
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("requires a session", async () => {
    expect((await post(input(), {})).statusCode).toBe(401);
  });

  it("locks the lesson for admin edits once a log exists", async () => {
    expect((await post(input())).statusCode).toBe(201);
    const lessonInput: LessonInput = {
      name: "Changed",
      description: "Changed",
      difficulty: "beginner",
      tagIds: [(await insertTag(ctx.db, "Other")).id],
      recommendedTempoBpm: 60,
      recommendedDurationSeconds: 180,
    };
    const url = withId(ApiPaths.adminLesson, lesson.id);
    const responses = await Promise.all([
      ctx.app.inject({ method: "PUT", url, cookies, payload: lessonInput }),
      ctx.app.inject({ method: "DELETE", url, cookies }),
      ctx.app.inject({
        method: "POST",
        url: withId(ApiPaths.adminLessonUnpublish, lesson.id),
        cookies,
      }),
    ]);
    for (const res of responses) {
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe("LESSON_LOCKED");
    }
  });

  it("is listed in the OpenAPI document", async () => {
    const res = await ctx.app.inject({ method: "GET", url: `${ApiPaths.docs}/json` });
    expect(Object.keys(res.json().paths)).toContain(ApiPaths.practiceLogs);
  });
});

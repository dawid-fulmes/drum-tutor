import { randomUUID } from "node:crypto";
import { lessons, lessonTags, practiceLogs, tags } from "@drum-tutor/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertLesson, insertPracticeLog, insertTag, insertUser } from "../test/fixtures";
import { createTestApp, resetDatabase } from "../test/helpers";

const PG_CHECK_VIOLATION = "23514";
const PG_UNIQUE_VIOLATION = "23505";
const PG_NOT_NULL_VIOLATION = "23502";
// ON DELETE RESTRICT reports restrict_violation, not foreign_key_violation.
const PG_RESTRICT_VIOLATION = "23001";

// Drizzle wraps driver errors; the Postgres error (with its SQLSTATE `code`) is the `cause`.
async function pgErrorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return ((error as { cause?: { code?: string } }).cause ?? (error as { code?: string })).code;
  }
  return undefined;
}

describe("database constraints", () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetDatabase(ctx.db);
  });

  it.each([45, 3630])("rejects recommended duration %i", async (duration) => {
    const tag = await insertTag(ctx.db, "Groove");
    const code = await pgErrorCode(
      insertLesson(ctx.db, { recommendedDurationSeconds: duration, tagIds: [tag.id] }),
    );
    expect(code).toBe(PG_CHECK_VIOLATION);
  });

  it("rejects recommended tempo below 30", async () => {
    const tag = await insertTag(ctx.db, "Groove");
    const code = await pgErrorCode(
      insertLesson(ctx.db, { recommendedTempoBpm: 29, tagIds: [tag.id] }),
    );
    expect(code).toBe(PG_CHECK_VIOLATION);
  });

  it("rejects tag names that differ only by case", async () => {
    await insertTag(ctx.db, "Groove");
    const code = await pgErrorCode(insertTag(ctx.db, "groove"));
    expect(code).toBe(PG_UNIQUE_VIOLATION);
  });

  it("refuses to delete a tag used by a lesson", async () => {
    const tag = await insertTag(ctx.db, "Groove");
    await insertLesson(ctx.db, { tagIds: [tag.id] });
    const code = await pgErrorCode(ctx.db.delete(tags).where(eq(tags.id, tag.id)));
    expect(code).toBe(PG_RESTRICT_VIOLATION);
  });

  it("removes lesson_tags when a lesson is deleted", async () => {
    const tag = await insertTag(ctx.db, "Groove");
    const lesson = await insertLesson(ctx.db, { tagIds: [tag.id] });
    await ctx.db.delete(lessons).where(eq(lessons.id, lesson.id));
    expect(await ctx.db.select().from(lessonTags)).toEqual([]);
  });

  it("refuses to delete a lesson that has a practice log", async () => {
    const tag = await insertTag(ctx.db, "Groove");
    const lesson = await insertLesson(ctx.db, { tagIds: [tag.id] });
    await insertPracticeLog(ctx.db, lesson.id);
    const code = await pgErrorCode(ctx.db.delete(lessons).where(eq(lessons.id, lesson.id)));
    expect(code).toBe(PG_RESTRICT_VIOLATION);
    expect(await ctx.db.select().from(practiceLogs)).toHaveLength(1);
  });

  describe("practice log idempotency key", () => {
    // Raw SQL, so the test does not depend on the fixture's defaults.
    const insertLog = (userId: string, lessonId: string, key: string | null) =>
      ctx.db.execute(sql`
        insert into practice_logs
          (user_id, lesson_id, duration_seconds, tempo_bpm, completed_at, local_date, idempotency_key)
        values (${userId}, ${lessonId}, 180, 60, now(), current_date, ${key})
      `);

    it("rejects a second log of the same user with the same key", async () => {
      const tag = await insertTag(ctx.db, "Groove");
      const lesson = await insertLesson(ctx.db, { tagIds: [tag.id] });
      const user = await insertUser(ctx.db, "drummer@example.com");
      const key = randomUUID();
      await insertLog(user.id, lesson.id, key);
      expect(await pgErrorCode(insertLog(user.id, lesson.id, key))).toBe(PG_UNIQUE_VIOLATION);
    });

    it("allows the same key for two different users", async () => {
      const tag = await insertTag(ctx.db, "Groove");
      const lesson = await insertLesson(ctx.db, { tagIds: [tag.id] });
      const first = await insertUser(ctx.db, "first@example.com");
      const second = await insertUser(ctx.db, "second@example.com");
      const key = randomUUID();
      await insertLog(first.id, lesson.id, key);
      await insertLog(second.id, lesson.id, key);
      expect(await ctx.db.select().from(practiceLogs)).toHaveLength(2);
    });

    it("has no default", async () => {
      const tag = await insertTag(ctx.db, "Groove");
      const lesson = await insertLesson(ctx.db, { tagIds: [tag.id] });
      const user = await insertUser(ctx.db, "drummer@example.com");
      const code = await pgErrorCode(
        ctx.db.execute(sql`
          insert into practice_logs
            (user_id, lesson_id, duration_seconds, tempo_bpm, completed_at, local_date)
          values (${user.id}, ${lesson.id}, 180, 60, now(), current_date)
        `),
      );
      expect(code).toBe(PG_NOT_NULL_VIOLATION);
    });
  });

  it("defaults a new lesson to draft", async () => {
    const tag = await insertTag(ctx.db, "Groove");
    const lesson = await insertLesson(ctx.db, { tagIds: [tag.id] });
    expect(lesson.status).toBe("draft");
  });
});

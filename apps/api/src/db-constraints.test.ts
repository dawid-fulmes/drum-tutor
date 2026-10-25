import { lessons, lessonTags, practiceLogs, tags } from "@drum-tutor/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertLesson, insertPracticeLog, insertTag } from "../test/fixtures";
import { createTestApp, resetDatabase } from "../test/helpers";

const PG_CHECK_VIOLATION = "23514";
const PG_UNIQUE_VIOLATION = "23505";
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

  it("defaults a new lesson to draft", async () => {
    const tag = await insertTag(ctx.db, "Groove");
    const lesson = await insertLesson(ctx.db, { tagIds: [tag.id] });
    expect(lesson.status).toBe("draft");
  });
});

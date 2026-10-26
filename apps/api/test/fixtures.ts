import { randomUUID } from "node:crypto";
import { ApiPaths, type Signature } from "@drum-tutor/contracts";
import {
  type Database,
  type LessonRow,
  lessonRatings,
  lessons,
  lessonTags,
  type NewLessonRow,
  type NewPracticeLogRow,
  type PracticeLogRow,
  practiceLogs,
  recomputeLessonRating,
  type TagRow,
  tags,
  users,
} from "@drum-tutor/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

const SESSION_COOKIE = "dt_session";

/** A signature with notes, so fixture lessons can be published (ADR-0053). */
export const TEST_SIGNATURE: Signature = {
  version: "v1",
  slots: Array.from({ length: 8 }, () => ({ instruments: ["snare"], comment: "" })),
};

export async function loginCookies(
  app: FastifyInstance,
  email = "user@example.com",
): Promise<Record<string, string>> {
  const res = await app.inject({ method: "POST", url: ApiPaths.login, payload: { email } });
  const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE);
  if (!cookie) {
    throw new Error(`Login did not set a session cookie (status ${res.statusCode})`);
  }
  return { [SESSION_COOKIE]: cookie.value };
}

export async function insertTag(db: Database, name: string): Promise<TagRow> {
  const [row] = await db.insert(tags).values({ name }).returning();
  return row as TagRow;
}

export async function insertLesson(
  db: Database,
  values: Partial<NewLessonRow> & { tagIds: string[] },
): Promise<LessonRow> {
  const { tagIds, ...lessonValues } = values;
  const [lesson] = await db
    .insert(lessons)
    .values({
      name: "Lesson",
      description: "Description",
      difficulty: "beginner",
      recommendedTempoBpm: 60,
      recommendedDurationSeconds: 180,
      status: "draft",
      signature: TEST_SIGNATURE,
      ...lessonValues,
    })
    .returning();
  const row = lesson as LessonRow;
  if (tagIds.length > 0) {
    await db.insert(lessonTags).values(tagIds.map((tagId) => ({ lessonId: row.id, tagId })));
  }
  return row;
}

export async function insertUser(db: Database, email: string): Promise<{ id: string }> {
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return existing;
  const [created] = await db.insert(users).values({ email }).returning();
  return created as { id: string };
}

export async function insertPracticeLog(
  db: Database,
  lessonId: string,
  values: Partial<NewPracticeLogRow> = {},
): Promise<PracticeLogRow> {
  const userId = values.userId ?? (await insertUser(db, "logger@example.com")).id;
  const [row] = await db
    .insert(practiceLogs)
    .values({
      userId,
      lessonId,
      durationSeconds: 180,
      tempoBpm: 60,
      completedAt: new Date(),
      localDate: new Date().toISOString().slice(0, 10),
      idempotencyKey: randomUUID(),
      ...values,
    })
    .returning();
  return row as PracticeLogRow;
}

/** Inserts a rating and refreshes the lesson's aggregate, without going through the endpoint. */
export async function insertRating(
  db: Database,
  values: { lessonId: string; userId: string; rating: number },
): Promise<void> {
  await db.insert(lessonRatings).values(values);
  await recomputeLessonRating(db, values.lessonId);
}

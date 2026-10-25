import { ApiPaths } from "@drum-tutor/contracts";
import {
  type Database,
  type LessonRow,
  lessons,
  lessonTags,
  type NewLessonRow,
  type PracticeLogRow,
  practiceLogs,
  type TagRow,
  tags,
  users,
} from "@drum-tutor/db";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

const SESSION_COOKIE = "dt_session";

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
      ...lessonValues,
    })
    .returning();
  const row = lesson as LessonRow;
  if (tagIds.length > 0) {
    await db.insert(lessonTags).values(tagIds.map((tagId) => ({ lessonId: row.id, tagId })));
  }
  return row;
}

export async function insertPracticeLog(db: Database, lessonId: string): Promise<PracticeLogRow> {
  const email = "logger@example.com";
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  const user = existing ?? (await db.insert(users).values({ email }).returning())[0];
  const [row] = await db
    .insert(practiceLogs)
    .values({
      userId: (user as { id: string }).id,
      lessonId,
      durationSeconds: 180,
      tempoBpm: 60,
      completedAt: new Date(),
      localDate: new Date().toISOString().slice(0, 10),
    })
    .returning();
  return row as PracticeLogRow;
}

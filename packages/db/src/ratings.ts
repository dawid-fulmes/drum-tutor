import { eq, sql } from "drizzle-orm";
import type { Database } from "./client";
import { lessonRatings, lessons } from "./schema";

type DbExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Recomputes `lessons.rating_count` and `lessons.rating_avg` from `lesson_ratings` and returns
 * them. This is the only writer of the aggregate (ADR-0055). Callers that may race (two users
 * rating the same lesson) must lock the lesson row `FOR UPDATE` first, otherwise two recomputes
 * read snapshots that miss each other.
 */
export async function recomputeLessonRating(
  db: DbExecutor,
  lessonId: string,
): Promise<{ ratingCount: number; ratingAvg: string | null }> {
  const [row] = await db
    .update(lessons)
    .set({
      ratingCount: sql`(select count(*)::int from ${lessonRatings} where ${lessonRatings.lessonId} = ${lessonId})`,
      ratingAvg: sql`(select round(avg(${lessonRatings.rating}), 2) from ${lessonRatings} where ${lessonRatings.lessonId} = ${lessonId})`,
    })
    .where(eq(lessons.id, lessonId))
    .returning({ ratingCount: lessons.ratingCount, ratingAvg: lessons.ratingAvg });
  if (!row) throw new Error(`Lesson ${lessonId} not found`);
  return row;
}

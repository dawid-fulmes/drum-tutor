import { ApiErrorCode, type LessonRating } from "@drum-tutor/contracts";
import {
  type Database,
  lessonRatings,
  lessons,
  practiceLogs,
  recomputeLessonRating,
} from "@drum-tutor/db";
import { and, eq, sql } from "drizzle-orm";
import { AppError } from "../../plugins/error-handler";
import { toRatingSummary } from "./lesson-tags";

/**
 * Creates or replaces the user's rating of a published lesson they have completed (R3) and
 * returns the fresh aggregate (spec §6.3).
 */
export async function rateLesson(
  db: Database,
  userId: string,
  lessonId: string,
  rating: number,
): Promise<LessonRating> {
  return db.transaction(async (tx) => {
    // Lock the lesson first: concurrent rating writes for one lesson then run one after another,
    // so each recompute sees every committed rating (ADR-0055). FOR UPDATE also waits for a
    // practice-log insert holding FOR SHARE, so a log saved just before is visible below.
    const [lesson] = await tx
      .select({ id: lessons.id })
      .from(lessons)
      .where(and(eq(lessons.id, lessonId), eq(lessons.status, "published")))
      .for("update");
    if (!lesson) throw new AppError(404, ApiErrorCode.NOT_FOUND, "Lesson not found");

    const [log] = await tx
      .select({ one: sql`1` })
      .from(practiceLogs)
      .where(and(eq(practiceLogs.userId, userId), eq(practiceLogs.lessonId, lessonId)))
      .limit(1);
    if (!log) {
      throw new AppError(
        409,
        ApiErrorCode.RATING_REQUIRES_COMPLETION,
        "Complete this lesson once before rating it",
      );
    }

    await tx
      .insert(lessonRatings)
      .values({ lessonId, userId, rating })
      .onConflictDoUpdate({
        target: [lessonRatings.lessonId, lessonRatings.userId],
        set: { rating, updatedAt: sql`now()` },
      });

    const aggregate = await recomputeLessonRating(tx, lessonId);
    return { rating: toRatingSummary(aggregate), myRating: rating };
  });
}

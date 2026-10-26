import {
  ApiErrorCode,
  type LessonDetail,
  type LessonSummary,
  type LibraryQuery,
  type Page,
} from "@drum-tutor/contracts";
import { type Database, lessonRatings, lessons, lessonTags, practiceLogs } from "@drum-tutor/db";
import { and, asc, count, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { pageOffset, toPage } from "../../lib/pagination";
import { AppError } from "../../plugins/error-handler";
import { loadTagsForLessons, toLessonSummary } from "./lesson-tags";
import { toSignature } from "./signature";

/**
 * Published lessons only (R11). The tag filter is an AND: a lesson must carry every selected tag,
 * so we keep lessons whose count of matching `lesson_tags` rows equals the number of distinct ids.
 */
function libraryWhere(db: Database, q: LibraryQuery) {
  const tagIds = [...new Set(q.tagIds)];
  const withAllTags =
    tagIds.length > 0
      ? inArray(
          lessons.id,
          db
            .select({ id: lessonTags.lessonId })
            .from(lessonTags)
            .where(inArray(lessonTags.tagId, tagIds))
            .groupBy(lessonTags.lessonId)
            .having(sql`count(*) = ${tagIds.length}`),
        )
      : undefined;
  return and(
    eq(lessons.status, "published"),
    q.difficulties.length > 0 ? inArray(lessons.difficulty, q.difficulties) : undefined,
    withAllTags,
  );
}

/** Rating order (ADR-0058) matches `lessons_status_rating_idx`; ties end in the unique `id`. */
function libraryOrder(sort: LibraryQuery["sort"]): SQL[] {
  switch (sort) {
    case "rating":
      return [
        sql`${lessons.ratingAvg} desc nulls last`,
        sql`${lessons.ratingCount} desc nulls last`,
        sql`${lessons.createdAt} desc nulls last`,
        sql`${lessons.id} desc nulls last`,
      ];
    case "oldest":
      return [asc(lessons.createdAt), asc(lessons.id)];
    case "newest":
      return [desc(lessons.createdAt), desc(lessons.id)];
  }
}

export async function listLibrary(db: Database, q: LibraryQuery): Promise<Page<LessonSummary>> {
  const where = libraryWhere(db, q);
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(lessons)
      .where(where)
      .orderBy(...libraryOrder(q.sort))
      .limit(q.pageSize)
      .offset(pageOffset(q)),
    db.select({ value: count() }).from(lessons).where(where),
  ]);
  const tagsByLesson = await loadTagsForLessons(
    db,
    rows.map((row) => row.id),
  );
  const items = rows.map((row) => toLessonSummary(row, tagsByLesson.get(row.id) ?? []));
  return toPage(items, q, total?.value ?? 0);
}

export async function getPublishedLesson(
  db: Database,
  id: string,
  userId: string,
): Promise<LessonDetail> {
  const [row] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, id), eq(lessons.status, "published")));
  if (!row) throw new AppError(404, ApiErrorCode.NOT_FOUND, "Lesson not found");
  const [tagsByLesson, [mine], [log]] = await Promise.all([
    loadTagsForLessons(db, [id]),
    db
      .select({ rating: lessonRatings.rating })
      .from(lessonRatings)
      .where(and(eq(lessonRatings.lessonId, id), eq(lessonRatings.userId, userId))),
    // `canRate` (R3): the user has logged this lesson at least once.
    db
      .select({ id: practiceLogs.id })
      .from(practiceLogs)
      .where(and(eq(practiceLogs.lessonId, id), eq(practiceLogs.userId, userId)))
      .limit(1),
  ]);
  return {
    ...toLessonSummary(row, tagsByLesson.get(id) ?? []),
    description: row.description,
    signature: toSignature(row.signature),
    myRating: mine?.rating ?? null,
    canRate: log !== undefined,
  };
}

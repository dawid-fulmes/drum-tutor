import {
  ApiErrorCode,
  type LessonDetail,
  type LessonSummary,
  type LibraryQuery,
  type Page,
} from "@drum-tutor/contracts";
import { type Database, lessons, lessonTags } from "@drum-tutor/db";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { pageOffset, toPage } from "../../lib/pagination";
import { AppError } from "../../plugins/error-handler";
import { loadTagsForLessons, toLessonSummary } from "./lesson-tags";

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

export async function listLibrary(db: Database, q: LibraryQuery): Promise<Page<LessonSummary>> {
  const where = libraryWhere(db, q);
  const direction = q.sort === "oldest" ? asc : desc;
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(lessons)
      .where(where)
      .orderBy(direction(lessons.createdAt), direction(lessons.id))
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

export async function getPublishedLesson(db: Database, id: string): Promise<LessonDetail> {
  const [row] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, id), eq(lessons.status, "published")));
  if (!row) throw new AppError(404, ApiErrorCode.NOT_FOUND, "Lesson not found");
  const tagsByLesson = await loadTagsForLessons(db, [id]);
  return { ...toLessonSummary(row, tagsByLesson.get(id) ?? []), description: row.description };
}

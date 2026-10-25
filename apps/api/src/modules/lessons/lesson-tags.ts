import type { LessonSummary, Tag } from "@drum-tutor/contracts";
import { type LessonRow, lessonTags, tags } from "@drum-tutor/db";
import { asc, eq, inArray, sql } from "drizzle-orm";
import type { DbExecutor } from "../../lib/db";

/** Tags of many lessons in one query; each list is sorted by name, case-insensitively. */
export async function loadTagsForLessons(
  db: DbExecutor,
  lessonIds: string[],
): Promise<Map<string, Tag[]>> {
  const byLesson = new Map<string, Tag[]>(lessonIds.map((id) => [id, []]));
  if (lessonIds.length === 0) return byLesson;
  const rows = await db
    .select({ lessonId: lessonTags.lessonId, id: tags.id, name: tags.name })
    .from(lessonTags)
    .innerJoin(tags, eq(tags.id, lessonTags.tagId))
    .where(inArray(lessonTags.lessonId, lessonIds))
    .orderBy(asc(sql`lower(${tags.name})`), asc(tags.id));
  for (const { lessonId, id, name } of rows) byLesson.get(lessonId)?.push({ id, name });
  return byLesson;
}

export function toLessonSummary(row: LessonRow, tags: Tag[]): LessonSummary {
  return {
    id: row.id,
    name: row.name,
    difficulty: row.difficulty,
    tags,
    recommendedTempoBpm: row.recommendedTempoBpm,
    recommendedDurationSeconds: row.recommendedDurationSeconds,
    createdAt: row.createdAt.toISOString(),
  };
}

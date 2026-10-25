import {
  type AdminLesson,
  type AdminLessonSummary,
  ApiErrorCode,
  type LessonInput,
  type Page,
  type PaginationQuery,
  type Tag,
} from "@drum-tutor/contracts";
import { type Database, type LessonRow, lessons, lessonTags, practiceLogs } from "@drum-tutor/db";
import { count, desc, eq, getTableColumns, sql } from "drizzle-orm";
import type { DbExecutor, Transaction } from "../../lib/db";
import { pageOffset, toPage } from "../../lib/pagination";
import { hasPgErrorCode, PgErrorCode } from "../../lib/pg-errors";
import { AppError } from "../../plugins/error-handler";
import { findExistingTagIds } from "../tags/tags.repository";
import { loadTagsForLessons, toLessonSummary } from "./lesson-tags";

const notFound = () => new AppError(404, ApiErrorCode.NOT_FOUND, "Lesson not found");
const lessonLocked = () =>
  new AppError(
    409,
    ApiErrorCode.LESSON_LOCKED,
    "This lesson has practice logs and can't be changed",
  );
const unknownTags = (ids: string[]) =>
  new AppError(
    400,
    ApiErrorCode.VALIDATION_ERROR,
    "Invalid request",
    ids.map((id) => ({ path: "tagIds", message: `Unknown tag: ${id}` })),
  );

/**
 * `locked` (ADR-0003) is computed in the same query as the lesson rows. Columns are qualified by
 * hand: in a single-table select Drizzle renders `"id"` without its table, which inside the
 * subquery would resolve to `practice_logs.id`.
 */
const lockedSql = sql<boolean>`exists (select 1 from ${practiceLogs} where ${practiceLogs}.${sql.identifier(practiceLogs.lessonId.name)} = ${lessons}.${sql.identifier(lessons.id.name)})`;
const adminColumns = { ...getTableColumns(lessons), locked: lockedSql };
type AdminLessonRow = LessonRow & { locked: boolean };

function toAdminLessonSummary(row: AdminLessonRow, tags: Tag[]): AdminLessonSummary {
  return { ...toLessonSummary(row, tags), status: row.status, locked: row.locked };
}

function toAdminLesson(row: AdminLessonRow, tags: Tag[]): AdminLesson {
  return { ...toAdminLessonSummary(row, tags), description: row.description };
}

export async function listAdminLessons(
  db: Database,
  q: PaginationQuery,
): Promise<Page<AdminLessonSummary>> {
  const [rows, [total]] = await Promise.all([
    db
      .select(adminColumns)
      .from(lessons)
      .orderBy(desc(lessons.createdAt), desc(lessons.id))
      .limit(q.pageSize)
      .offset(pageOffset(q)),
    db.select({ value: count() }).from(lessons),
  ]);
  const tagsByLesson = await loadTagsForLessons(
    db,
    rows.map((row) => row.id),
  );
  const items = rows.map((row) => toAdminLessonSummary(row, tagsByLesson.get(row.id) ?? []));
  return toPage(items, q, total?.value ?? 0);
}

async function loadAdminLesson(db: DbExecutor, id: string): Promise<AdminLesson> {
  const [row] = await db.select(adminColumns).from(lessons).where(eq(lessons.id, id));
  if (!row) throw notFound();
  const tagsByLesson = await loadTagsForLessons(db, [id]);
  return toAdminLesson(row, tagsByLesson.get(id) ?? []);
}

export async function getAdminLesson(db: Database, id: string): Promise<AdminLesson> {
  return loadAdminLesson(db, id);
}

/**
 * Locks the lesson row and refuses the write if it has practice logs (R7, R11, ADR-0003).
 * The log check is a separate statement on purpose: after `FOR UPDATE` waited for a concurrent
 * log insert to commit, only a new statement's snapshot sees that log.
 */
async function lockUnloggedLesson(tx: Transaction, id: string): Promise<void> {
  const [row] = await tx
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.id, id))
    .for("update");
  if (!row) throw notFound();
  const [log] = await tx
    .select({ id: practiceLogs.id })
    .from(practiceLogs)
    .where(eq(practiceLogs.lessonId, id))
    .limit(1);
  if (log) throw lessonLocked();
}

async function unknownTagIds(db: DbExecutor, tagIds: string[]): Promise<string[]> {
  const existing = await findExistingTagIds(db, tagIds);
  return tagIds.filter((id) => !existing.has(id));
}

async function assertTagsExist(tx: Transaction, tagIds: string[]): Promise<void> {
  const unknown = await unknownTagIds(tx, tagIds);
  if (unknown.length > 0) throw unknownTags(unknown);
}

/**
 * Runs a lesson write. The only foreign key such a write can violate is `lesson_tags.tag_id`
 * (a tag deleted after the existence check), which becomes the same 400 as an unknown tag.
 */
async function withTagRaceAsValidation<T>(
  db: Database,
  tagIds: string[],
  write: () => Promise<T>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (!hasPgErrorCode(error, PgErrorCode.FOREIGN_KEY_VIOLATION)) throw error;
    const unknown = await unknownTagIds(db, tagIds);
    if (unknown.length === 0) throw error;
    throw unknownTags(unknown);
  }
}

function lessonValues(input: LessonInput) {
  return {
    name: input.name,
    description: input.description,
    difficulty: input.difficulty,
    recommendedTempoBpm: input.recommendedTempoBpm,
    recommendedDurationSeconds: input.recommendedDurationSeconds,
  };
}

async function insertLessonTags(tx: Transaction, lessonId: string, tagIds: string[]) {
  await tx.insert(lessonTags).values(tagIds.map((tagId) => ({ lessonId, tagId })));
}

export async function createLesson(db: Database, input: LessonInput): Promise<AdminLesson> {
  return withTagRaceAsValidation(db, input.tagIds, () =>
    db.transaction(async (tx) => {
      await assertTagsExist(tx, input.tagIds);
      // Create always produces a draft (R11), whatever the client sent.
      const [row] = await tx
        .insert(lessons)
        .values({ ...lessonValues(input), status: "draft" })
        .returning({ id: lessons.id });
      if (!row) throw new Error("Lesson insert returned no row");
      await insertLessonTags(tx, row.id, input.tagIds);
      return loadAdminLesson(tx, row.id);
    }),
  );
}

/** Replaces all fields and the full tag set; status and createdAt stay as they are. */
export async function updateLesson(
  db: Database,
  id: string,
  input: LessonInput,
): Promise<AdminLesson> {
  return withTagRaceAsValidation(db, input.tagIds, () =>
    db.transaction(async (tx) => {
      await lockUnloggedLesson(tx, id);
      await assertTagsExist(tx, input.tagIds);
      await tx.update(lessons).set(lessonValues(input)).where(eq(lessons.id, id));
      await tx.delete(lessonTags).where(eq(lessonTags.lessonId, id));
      await insertLessonTags(tx, id, input.tagIds);
      return loadAdminLesson(tx, id);
    }),
  );
}

export async function deleteLesson(db: Database, id: string): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await lockUnloggedLesson(tx, id);
      await tx.delete(lessons).where(eq(lessons.id, id));
    });
  } catch (error) {
    // Backstop: `practice_logs.lesson_id` is ON DELETE RESTRICT (23001); 23503 covers NO ACTION.
    if (
      hasPgErrorCode(error, PgErrorCode.RESTRICT_VIOLATION) ||
      hasPgErrorCode(error, PgErrorCode.FOREIGN_KEY_VIOLATION)
    ) {
      throw lessonLocked();
    }
    throw error;
  }
}

/** Idempotent, and not blocked by practice logs (spec §5.3). */
export async function publishLesson(db: Database, id: string): Promise<AdminLesson> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(lessons)
      .set({ status: "published" })
      .where(eq(lessons.id, id))
      .returning({ id: lessons.id });
    if (updated.length === 0) throw notFound();
    return loadAdminLesson(tx, id);
  });
}

/** Unpublishing a draft is a no-op; a lesson with practice logs cannot be unpublished. */
export async function unpublishLesson(db: Database, id: string): Promise<AdminLesson> {
  return db.transaction(async (tx) => {
    await lockUnloggedLesson(tx, id);
    await tx.update(lessons).set({ status: "draft" }).where(eq(lessons.id, id));
    return loadAdminLesson(tx, id);
  });
}

import {
  type AdminTag,
  ApiErrorCode,
  type Page,
  type Tag,
  type TagListQuery,
} from "@drum-tutor/contracts";
import { type Database, lessonTags, tags } from "@drum-tutor/db";
import { and, asc, count, eq, ilike, inArray, type SQL, sql } from "drizzle-orm";
import { pageOffset, toPage } from "../../lib/pagination";
import { hasPgErrorCode, PgErrorCode } from "../../lib/pg-errors";
import { escapeLike } from "../../lib/sql";
import { AppError } from "../../plugins/error-handler";

function listFilter(q: TagListQuery): SQL | undefined {
  const conditions: SQL[] = [];
  if (q.q) conditions.push(ilike(tags.name, `%${escapeLike(q.q)}%`));
  if (q.ids.length > 0) conditions.push(inArray(tags.id, q.ids));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

const byName = [asc(sql`lower(${tags.name})`), asc(tags.id)];

async function countTags(db: Database, where: SQL | undefined): Promise<number> {
  const [row] = await db.select({ total: count() }).from(tags).where(where);
  return row?.total ?? 0;
}

export async function listTags(db: Database, q: TagListQuery): Promise<Page<Tag>> {
  const where = listFilter(q);
  const [items, total] = await Promise.all([
    db
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(where)
      .orderBy(...byName)
      .limit(q.pageSize)
      .offset(pageOffset(q)),
    countTags(db, where),
  ]);
  return toPage(items, q, total);
}

export async function listAdminTags(db: Database, q: TagListQuery): Promise<Page<AdminTag>> {
  const where = listFilter(q);
  const [items, total] = await Promise.all([
    db
      .select({ id: tags.id, name: tags.name, lessonCount: count(lessonTags.lessonId) })
      .from(tags)
      .leftJoin(lessonTags, eq(lessonTags.tagId, tags.id))
      .where(where)
      .groupBy(tags.id, tags.name)
      .orderBy(...byName)
      .limit(q.pageSize)
      .offset(pageOffset(q)),
    countTags(db, where),
  ]);
  return toPage(items, q, total);
}

const nameTaken = (name: string) =>
  new AppError(409, ApiErrorCode.TAG_NAME_TAKEN, `A tag named "${name}" already exists`);
const notFound = () => new AppError(404, ApiErrorCode.NOT_FOUND, "Tag not found");

export async function createTag(db: Database, name: string): Promise<AdminTag> {
  try {
    const [row] = await db.insert(tags).values({ name }).returning();
    return { id: (row as Tag).id, name: (row as Tag).name, lessonCount: 0 };
  } catch (error) {
    if (hasPgErrorCode(error, PgErrorCode.UNIQUE_VIOLATION)) throw nameTaken(name);
    throw error;
  }
}

export async function renameTag(db: Database, id: string, name: string): Promise<AdminTag> {
  try {
    const [row] = await db.update(tags).set({ name }).where(eq(tags.id, id)).returning();
    if (!row) throw notFound();
    const [usage] = await db
      .select({ lessonCount: count() })
      .from(lessonTags)
      .where(eq(lessonTags.tagId, id));
    return { id: row.id, name: row.name, lessonCount: usage?.lessonCount ?? 0 };
  } catch (error) {
    if (hasPgErrorCode(error, PgErrorCode.UNIQUE_VIOLATION)) throw nameTaken(name);
    throw error;
  }
}

export async function deleteTag(db: Database, id: string): Promise<void> {
  try {
    const deleted = await db.delete(tags).where(eq(tags.id, id)).returning({ id: tags.id });
    if (deleted.length === 0) throw notFound();
  } catch (error) {
    if (
      hasPgErrorCode(error, PgErrorCode.RESTRICT_VIOLATION) ||
      hasPgErrorCode(error, PgErrorCode.FOREIGN_KEY_VIOLATION)
    ) {
      throw new AppError(
        409,
        ApiErrorCode.TAG_IN_USE,
        "This tag is used by lessons and can't be deleted",
      );
    }
    throw error;
  }
}

export async function findExistingTagIds(db: Database, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db.select({ id: tags.id }).from(tags).where(inArray(tags.id, ids));
  return new Set(rows.map((row) => row.id));
}

import { ApiErrorCode, type PracticeLog, type PracticeLogInput } from "@drum-tutor/contracts";
import { type Database, lessons, type PracticeLogRow, practiceLogs } from "@drum-tutor/db";
import { and, eq } from "drizzle-orm";
import type { DbExecutor } from "../../lib/db";
import { AppError } from "../../plugins/error-handler";

/** How far ahead of the server clock a completion time may be (clock skew), spec §5.2. */
const COMPLETED_AT_MAX_SKEW_MS = 5 * 60 * 1000;

function toPracticeLog(row: PracticeLogRow): PracticeLog {
  return {
    id: row.id,
    lessonId: row.lessonId,
    durationSeconds: row.durationSeconds,
    tempoBpm: row.tempoBpm,
    completedAt: row.completedAt.toISOString(),
    localDate: row.localDate,
  };
}

async function findByKey(
  db: DbExecutor,
  userId: string,
  idempotencyKey: string,
): Promise<PracticeLogRow | undefined> {
  const [row] = await db
    .select()
    .from(practiceLogs)
    .where(and(eq(practiceLogs.userId, userId), eq(practiceLogs.idempotencyKey, idempotencyKey)));
  return row;
}

/**
 * Saves a completed session once per idempotency key (ADR-0042). A repeated key returns the stored
 * log, whatever the rest of the body says.
 */
export async function createPracticeLog(
  db: Database,
  userId: string,
  input: PracticeLogInput,
  now: Date = new Date(),
): Promise<{ log: PracticeLog; created: boolean }> {
  const existing = await findByKey(db, userId, input.idempotencyKey);
  if (existing) return { log: toPracticeLog(existing), created: false };

  const completedAt = new Date(input.completedAt);
  if (completedAt.getTime() > now.getTime() + COMPLETED_AT_MAX_SKEW_MS) {
    throw new AppError(400, ApiErrorCode.VALIDATION_ERROR, "Invalid request", [
      { path: "completedAt", message: "Completion time can't be in the future" },
    ]);
  }

  return db.transaction(async (tx) => {
    // FOR SHARE conflicts with the admin's FOR UPDATE, so a log cannot appear between an admin's
    // lock check and write (ADR-0034).
    const [lesson] = await tx
      .select({ status: lessons.status })
      .from(lessons)
      .where(eq(lessons.id, input.lessonId))
      .for("share");
    if (lesson?.status !== "published") {
      throw new AppError(404, ApiErrorCode.NOT_FOUND, "Lesson not found");
    }

    const [inserted] = await tx
      .insert(practiceLogs)
      .values({
        userId,
        lessonId: input.lessonId,
        durationSeconds: input.durationSeconds,
        tempoBpm: input.tempoBpm,
        completedAt,
        localDate: input.localDate,
        idempotencyKey: input.idempotencyKey,
      })
      .onConflictDoNothing({ target: [practiceLogs.userId, practiceLogs.idempotencyKey] })
      .returning();
    if (inserted) return { log: toPracticeLog(inserted), created: true };

    // A concurrent request with the same key won the insert.
    const winner = await findByKey(tx, userId, input.idempotencyKey);
    if (!winner) throw new Error("Practice log vanished after an idempotency conflict");
    return { log: toPracticeLog(winner), created: false };
  });
}

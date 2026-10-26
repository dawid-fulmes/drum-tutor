import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Always stored normalized (ADR-0024).
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// This package does not depend on @drum-tutor/contracts, so the enum values are repeated here.
export const lessonDifficulty = pgEnum("lesson_difficulty", [
  "beginner",
  "intermediate",
  "advanced",
]);
export const lessonStatus = pgEnum("lesson_status", ["draft", "published"]);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Stored normalized (ADR-0036).
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tags_name_lower_unique").on(sql`lower(${t.name})`)],
);

/**
 * The signature JSON (ADR-0050). Its shape is defined and validated only by `SignatureSchema` in
 * @drum-tutor/contracts, which this package does not depend on.
 */
export type LessonSignatureJson = {
  version: string;
  slots: { instruments: string[]; comment: string }[];
};

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    difficulty: lessonDifficulty("difficulty").notNull(),
    recommendedTempoBpm: integer("recommended_tempo_bpm").notNull(),
    recommendedDurationSeconds: integer("recommended_duration_seconds").notNull(),
    status: lessonStatus("status").notNull().default("draft"),
    signature: jsonb("signature").$type<LessonSignatureJson>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("lessons_tempo_range", sql`${t.recommendedTempoBpm} between 30 and 300`),
    check(
      "lessons_duration_range",
      sql`${t.recommendedDurationSeconds} between 30 and 3600 and ${t.recommendedDurationSeconds} % 30 = 0`,
    ),
    index("lessons_status_created_at_id_idx").on(t.status, t.createdAt, t.id),
  ],
);

export const lessonTags = pgTable(
  "lesson_tags",
  {
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    // Restrict is the backstop for R8: a tag in use cannot be deleted.
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.lessonId, t.tagId] }),
    index("lesson_tags_tag_id_idx").on(t.tagId),
  ],
);

// Created empty by this scope (ADR-0034); the practice scope fills it.
export const practiceLogs = pgTable(
  "practice_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Restrict is the backstop for R7: a lesson with logs cannot be deleted.
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "restrict" }),
    durationSeconds: integer("duration_seconds").notNull(),
    tempoBpm: integer("tempo_bpm").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
    // The user's local calendar date at completion (R12, ADR-0007).
    localDate: date("local_date").notNull(),
    // The client sends the same key on every retry of one session (US-11b, ADR-0042).
    idempotencyKey: uuid("idempotency_key").notNull(),
  },
  (t) => [
    check(
      "practice_logs_duration_range",
      sql`${t.durationSeconds} between 30 and 3600 and ${t.durationSeconds} % 30 = 0`,
    ),
    check("practice_logs_tempo_range", sql`${t.tempoBpm} between 30 and 300`),
    index("practice_logs_lesson_id_idx").on(t.lessonId),
    uniqueIndex("practice_logs_user_idempotency_key_idx").on(t.userId, t.idempotencyKey),
    // The migration adds INCLUDE (lesson_id, duration_seconds) by hand, so stats read only the
    // index; Drizzle 0.45 cannot express INCLUDE (ADR-0048).
    index("practice_logs_user_local_date_idx").on(t.userId, t.localDate),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type TagRow = typeof tags.$inferSelect;
export type LessonRow = typeof lessons.$inferSelect;
export type NewLessonRow = typeof lessons.$inferInsert;
export type PracticeLogRow = typeof practiceLogs.$inferSelect;
export type NewPracticeLogRow = typeof practiceLogs.$inferInsert;

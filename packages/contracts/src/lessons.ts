import { z } from "zod";
import { PaginationQuerySchema, queryArray } from "./pagination";
import { RatingSummarySchema, RatingValueSchema } from "./rating";
import { SignatureSchema } from "./signature";
import { TagSchema } from "./tags";

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export const DifficultySchema = z.enum(DIFFICULTIES, { error: "Choose a difficulty" });
export type Difficulty = z.infer<typeof DifficultySchema>;

export const LessonStatusSchema = z.enum(["draft", "published"]);
export type LessonStatus = z.infer<typeof LessonStatusSchema>;

export const LessonSortSchema = z.enum(["rating", "newest", "oldest"]);
export type LessonSort = z.infer<typeof LessonSortSchema>;

export const TEMPO_BPM = { min: 30, max: 300 } as const;
export const DURATION_SECONDS = { min: 30, max: 3600, step: 30 } as const;

const TEMPO_MESSAGE = "Tempo must be between 30 and 300 BPM";
const DURATION_RANGE_MESSAGE = "Duration must be between 0:30 and 60:00";
const DURATION_STEP_MESSAGE = "Duration must be in 30-second steps";

/** Tempo in BPM (R10). */
export const TempoBpmSchema = z
  .number(TEMPO_MESSAGE)
  .int(TEMPO_MESSAGE)
  .min(TEMPO_BPM.min, TEMPO_MESSAGE)
  .max(TEMPO_BPM.max, TEMPO_MESSAGE);

/** Duration in seconds, 30 s – 60 min in 30-second steps (R10). */
export const DurationSecondsSchema = z
  .number(DURATION_RANGE_MESSAGE)
  .int(DURATION_STEP_MESSAGE)
  .min(DURATION_SECONDS.min, DURATION_RANGE_MESSAGE)
  .max(DURATION_SECONDS.max, DURATION_RANGE_MESSAGE)
  .multipleOf(DURATION_SECONDS.step, DURATION_STEP_MESSAGE);

export const LessonInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name can be at most 120 characters"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(5000, "Description can be at most 5000 characters"),
  difficulty: DifficultySchema,
  tagIds: z
    .array(z.uuid())
    .min(1, "Choose at least one tag")
    .max(10, "A lesson can have at most 10 tags")
    .refine((ids) => new Set(ids).size === ids.length, "A tag can only be selected once"),
  recommendedTempoBpm: TempoBpmSchema,
  recommendedDurationSeconds: DurationSecondsSchema,
  signature: SignatureSchema,
});
export type LessonInput = z.input<typeof LessonInputSchema>;

export const LessonSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  difficulty: DifficultySchema,
  tags: z.array(TagSchema),
  recommendedTempoBpm: z.number().int(),
  recommendedDurationSeconds: z.number().int(),
  createdAt: z.iso.datetime(),
  rating: RatingSummarySchema,
});
export type LessonSummary = z.infer<typeof LessonSummarySchema>;

export const LessonContentSchema = LessonSummarySchema.extend({
  description: z.string(),
  signature: SignatureSchema,
});
export type LessonContent = z.infer<typeof LessonContentSchema>;

export const LessonDetailSchema = LessonContentSchema.extend({
  myRating: RatingValueSchema.nullable(),
  canRate: z.boolean(),
});
export type LessonDetail = z.infer<typeof LessonDetailSchema>;

const adminFields = { status: LessonStatusSchema, locked: z.boolean() };

export const AdminLessonSummarySchema = LessonSummarySchema.extend(adminFields);
export type AdminLessonSummary = z.infer<typeof AdminLessonSummarySchema>;

export const AdminLessonSchema = LessonContentSchema.extend(adminFields);
export type AdminLesson = z.infer<typeof AdminLessonSchema>;

export const LibraryQuerySchema = PaginationQuerySchema.extend({
  tagIds: queryArray(z.uuid(), 20),
  difficulties: queryArray(DifficultySchema, 3),
  sort: LessonSortSchema.default("rating"),
});
export type LibraryQuery = z.output<typeof LibraryQuerySchema>;

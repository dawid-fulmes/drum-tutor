import { z } from "zod";

export const RATING = { min: 1, max: 5 } as const;

const RATING_MESSAGE = "Choose a rating from 1 to 5";

/** A single user's rating of a lesson, 1–5 stars (whole numbers). */
export const RatingValueSchema = z
  .number(RATING_MESSAGE)
  .int(RATING_MESSAGE)
  .min(RATING.min, RATING_MESSAGE)
  .max(RATING.max, RATING_MESSAGE);
export type RatingValue = z.infer<typeof RatingValueSchema>;

/** Aggregate of all ratings of a lesson; `average` is null while unrated. */
export const RatingSummarySchema = z.object({
  average: z.number().min(RATING.min).max(RATING.max).nullable(),
  count: z.number().int().min(0),
});
export type RatingSummary = z.infer<typeof RatingSummarySchema>;

export const RateLessonInputSchema = z.object({ rating: RatingValueSchema });
export type RateLessonInput = z.input<typeof RateLessonInputSchema>;

/** Response of rating a lesson: the fresh aggregate and the caller's own rating. */
export const LessonRatingSchema = z.object({
  rating: RatingSummarySchema,
  myRating: RatingValueSchema,
});
export type LessonRating = z.infer<typeof LessonRatingSchema>;

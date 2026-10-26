import { describe, expect, it } from "vitest";
import {
  LessonRatingSchema,
  RateLessonInputSchema,
  RatingSummarySchema,
  RatingValueSchema,
} from "./rating";

const MESSAGE = "Choose a rating from 1 to 5";

describe("RatingValueSchema", () => {
  it.each([1, 5])("accepts %s", (value) => {
    expect(RatingValueSchema.safeParse(value).success).toBe(true);
  });

  it.each([0, 6, 3.5, "4"])("rejects %j with the copy-table message", (value) => {
    const result = RatingValueSchema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(MESSAGE);
  });
});

describe("RatingSummarySchema", () => {
  it("accepts an unrated and a rated summary", () => {
    expect(RatingSummarySchema.safeParse({ average: null, count: 0 }).success).toBe(true);
    expect(RatingSummarySchema.safeParse({ average: 4.33, count: 3 }).success).toBe(true);
  });

  it("rejects an average below 1 and a negative count", () => {
    expect(RatingSummarySchema.safeParse({ average: 0.5, count: 1 }).success).toBe(false);
    expect(RatingSummarySchema.safeParse({ average: 4, count: -1 }).success).toBe(false);
  });
});

describe("RateLessonInputSchema", () => {
  it("rejects a body without rating", () => {
    expect(RateLessonInputSchema.safeParse({}).success).toBe(false);
  });
});

describe("LessonRatingSchema", () => {
  it("rejects a null myRating", () => {
    const result = LessonRatingSchema.safeParse({
      rating: { average: 4, count: 1 },
      myRating: null,
    });
    expect(result.success).toBe(false);
  });
});

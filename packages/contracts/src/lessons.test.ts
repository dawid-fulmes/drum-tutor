import { describe, expect, it } from "vitest";
import {
  AdminLessonSchema,
  LessonDetailSchema,
  LessonInputSchema,
  LibraryQuerySchema,
} from "./lessons";
import { EMPTY_SIGNATURE_V1 } from "./signature";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const base = {
  name: "Paradiddle basics",
  description: "Play slowly.",
  difficulty: "beginner",
  tagIds: [A],
  recommendedTempoBpm: 60,
  recommendedDurationSeconds: 180,
  signature: EMPTY_SIGNATURE_V1,
};

const ok = (override: Record<string, unknown>) =>
  LessonInputSchema.safeParse({ ...base, ...override }).success;

const firstMessage = (override: Record<string, unknown>) =>
  LessonInputSchema.safeParse({ ...base, ...override }).error?.issues[0]?.message;

describe("LessonInputSchema", () => {
  it("accepts a valid lesson", () => {
    expect(LessonInputSchema.safeParse(base).success).toBe(true);
  });

  it.each([30, 300])("accepts tempo %i", (tempo) => {
    expect(ok({ recommendedTempoBpm: tempo })).toBe(true);
  });

  it.each([29, 301, 60.5])("rejects tempo %s", (tempo) => {
    expect(ok({ recommendedTempoBpm: tempo })).toBe(false);
    expect(firstMessage({ recommendedTempoBpm: tempo })).toBe(
      "Tempo must be between 30 and 300 BPM",
    );
  });

  it.each([30, 3600])("accepts duration %i", (duration) => {
    expect(ok({ recommendedDurationSeconds: duration })).toBe(true);
  });

  it.each([0, 15, 45, 3630])("rejects duration %i", (duration) => {
    expect(ok({ recommendedDurationSeconds: duration })).toBe(false);
  });

  it("uses range and step messages for duration", () => {
    expect(firstMessage({ recommendedDurationSeconds: 3630 })).toBe(
      "Duration must be between 0:30 and 60:00",
    );
    expect(firstMessage({ recommendedDurationSeconds: 45 })).toBe(
      "Duration must be in 30-second steps",
    );
  });

  it("rejects no tags, 11 tags and a repeated tag", () => {
    expect(firstMessage({ tagIds: [] })).toBe("Choose at least one tag");
    const eleven = Array.from(
      { length: 11 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    expect(firstMessage({ tagIds: eleven })).toBe("A lesson can have at most 10 tags");
    expect(firstMessage({ tagIds: [A, A] })).toBe("A tag can only be selected once");
    expect(LessonInputSchema.safeParse({ ...base, tagIds: [A, B] }).data?.tagIds).toEqual([A, B]);
  });

  it("requires a signature", () => {
    const { signature: _, ...withoutSignature } = base;
    expect(LessonInputSchema.safeParse(withoutSignature).success).toBe(false);
  });

  it("rejects an empty difficulty with 'Choose a difficulty'", () => {
    expect(firstMessage({ difficulty: "" })).toBe("Choose a difficulty");
    expect(firstMessage({ difficulty: undefined })).toBe("Choose a difficulty");
  });

  it("trims name and description and rejects blank ones", () => {
    const parsed = LessonInputSchema.parse({ ...base, name: "  Name ", description: "  Text  " });
    expect(parsed.name).toBe("Name");
    expect(parsed.description).toBe("Text");
    expect(firstMessage({ name: "   " })).toBe("Name is required");
    expect(firstMessage({ name: "a".repeat(121) })).toBe("Name can be at most 120 characters");
    expect(firstMessage({ description: "  " })).toBe("Description is required");
    expect(firstMessage({ description: "a".repeat(5001) })).toBe(
      "Description can be at most 5000 characters",
    );
  });
});

describe("LibraryQuerySchema", () => {
  it("defaults filters and sort", () => {
    expect(LibraryQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      tagIds: [],
      difficulties: [],
      sort: "rating",
    });
  });

  it("accepts a single difficulty and rejects unknown ones", () => {
    expect(LibraryQuerySchema.parse({ difficulties: "advanced" }).difficulties).toEqual([
      "advanced",
    ]);
    expect(LibraryQuerySchema.safeParse({ difficulties: "expert" }).success).toBe(false);
  });

  it.each(["newest", "oldest", "rating"])("accepts sort %s", (sort) => {
    expect(LibraryQuerySchema.parse({ sort }).sort).toBe(sort);
  });

  it("rejects an unknown sort", () => {
    expect(LibraryQuerySchema.safeParse({ sort: "best" }).success).toBe(false);
  });
});

describe("lesson response shapes", () => {
  it("keeps per-user rating fields out of the admin lesson", () => {
    expect(AdminLessonSchema.shape).not.toHaveProperty("myRating");
    expect(AdminLessonSchema.shape).not.toHaveProperty("canRate");
    expect(AdminLessonSchema.shape).toHaveProperty("rating");
  });

  it("gives the lesson detail the rating summary and per-user fields", () => {
    expect(LessonDetailSchema.shape).toHaveProperty("rating");
    expect(LessonDetailSchema.shape).toHaveProperty("myRating");
    expect(LessonDetailSchema.shape).toHaveProperty("canRate");
  });
});

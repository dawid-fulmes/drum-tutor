import { describe, expect, it } from "vitest";
import { hasActiveFilters, librarySearchSchema } from "./library-search";

const A = "6f1d3c1e-8a52-4b0e-9a55-0c2f2f0d7a11";

describe("librarySearchSchema", () => {
  it("parses empty search to defaults", () => {
    expect(librarySearchSchema.parse({})).toEqual({
      page: 1,
      pageSize: 12,
      tagIds: [],
      difficulties: [],
      sort: "newest",
    });
  });

  it("falls back to defaults for garbage values", () => {
    expect(
      librarySearchSchema.parse({
        page: "abc",
        pageSize: 7,
        difficulties: ["expert"],
        sort: "best",
        tagIds: ["x"],
      }),
    ).toEqual({ page: 1, pageSize: 12, tagIds: [], difficulties: [], sort: "newest" });
  });

  it("falls back to page 1 for page 0, negative and fractional values", () => {
    for (const page of [0, -1, 1.5]) {
      expect(librarySearchSchema.parse({ page }).page).toBe(1);
    }
  });

  it("deduplicates tags and difficulties", () => {
    expect(
      librarySearchSchema.parse({
        pageSize: 24,
        difficulties: ["beginner", "beginner"],
        tagIds: [A, A],
      }),
    ).toMatchObject({ pageSize: 24, difficulties: ["beginner"], tagIds: [A] });
  });

  it("falls back to no tags when more than 20 are given", () => {
    const ids = Array.from(
      { length: 21 },
      (_, i) => `6f1d3c1e-8a52-4b0e-9a55-0c2f2f0d70${String(i).padStart(2, "0")}`,
    );
    expect(librarySearchSchema.parse({ tagIds: ids }).tagIds).toEqual([]);
  });
});

describe("hasActiveFilters", () => {
  it("does not treat sort as a filter", () => {
    expect(hasActiveFilters(librarySearchSchema.parse({ sort: "oldest" }))).toBe(false);
  });
  it("is true with difficulties", () => {
    expect(hasActiveFilters(librarySearchSchema.parse({ difficulties: ["advanced"] }))).toBe(true);
  });
  it("is true with tags", () => {
    expect(hasActiveFilters(librarySearchSchema.parse({ tagIds: [A] }))).toBe(true);
  });
});

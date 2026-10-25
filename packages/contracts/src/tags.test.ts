import { describe, expect, it } from "vitest";
import { TagListQuerySchema, TagNameSchema } from "./tags";

describe("TagNameSchema", () => {
  it("normalizes whitespace and keeps casing", () => {
    expect(TagNameSchema.parse("  Weak   hand ")).toBe("Weak hand");
  });

  it.each(["", "   ", "a".repeat(51)])("rejects %j", (value) => {
    expect(TagNameSchema.safeParse(value).success).toBe(false);
  });

  it("accepts 50 chars", () => {
    expect(TagNameSchema.parse("a".repeat(50))).toHaveLength(50);
  });

  it("uses the copy-table messages", () => {
    expect(TagNameSchema.safeParse("   ").error?.issues[0]?.message).toBe("Tag name is required");
    expect(TagNameSchema.safeParse("a".repeat(51)).error?.issues[0]?.message).toBe(
      "Tag name can be at most 50 characters",
    );
  });
});

describe("TagListQuerySchema", () => {
  it("defaults pagination and ids", () => {
    expect(TagListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20, ids: [] });
  });
});

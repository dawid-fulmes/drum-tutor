import { describe, expect, it } from "vitest";
import { adminLessonsSearchSchema } from "./admin-lessons-search";

describe("adminLessonsSearchSchema", () => {
  it("defaults an empty search", () => {
    expect(adminLessonsSearchSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("keeps valid values", () => {
    expect(adminLessonsSearchSchema.parse({ page: 3, pageSize: 50 })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it("falls back to defaults for invalid values", () => {
    expect(adminLessonsSearchSchema.parse({ page: 0, pageSize: 7 })).toEqual({
      page: 1,
      pageSize: 20,
    });
    expect(adminLessonsSearchSchema.parse({ page: "x" })).toEqual({ page: 1, pageSize: 20 });
  });
});

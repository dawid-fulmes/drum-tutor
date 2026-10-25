import { describe, expect, it } from "vitest";
import { z } from "zod";
import { IdParamsSchema, PaginationQuerySchema, pageSchema, queryArray } from "./pagination";
import { ApiPaths, withId } from "./paths";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("PaginationQuerySchema", () => {
  it("coerces page and pageSize from strings with defaults 1 and 20", () => {
    expect(PaginationQuerySchema.parse({ page: "3", pageSize: "12" })).toEqual({
      page: 3,
      pageSize: 12,
    });
    expect(PaginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it.each([{ page: "0" }, { pageSize: "0" }, { pageSize: "101" }, { page: "1.5" }])(
    "rejects %j",
    (query) => {
      expect(PaginationQuerySchema.safeParse(query).success).toBe(false);
    },
  );
});

describe("pageSchema", () => {
  const schema = pageSchema(z.object({ id: z.string() }));

  it("accepts a page and rejects negative totals", () => {
    const page = { items: [{ id: "x" }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };
    expect(schema.safeParse(page).success).toBe(true);
    expect(schema.safeParse({ ...page, totalItems: -1 }).success).toBe(false);
  });
});

describe("queryArray", () => {
  const schema = z.object({ ids: queryArray(z.uuid(), 2) });

  it("accepts a single value, an array, dedupes, and defaults to empty", () => {
    expect(schema.parse({ ids: A }).ids).toEqual([A]);
    expect(schema.parse({ ids: [A, A] }).ids).toEqual([A]);
    expect(schema.parse({}).ids).toEqual([]);
  });

  it("caps on the raw input, before deduplication", () => {
    expect(schema.safeParse({ ids: [A, B, C] }).success).toBe(false);
    expect(schema.safeParse({ ids: [A, A, A] }).success).toBe(false);
    expect(z.object({ ids: queryArray(z.uuid(), 3) }).parse({ ids: [A, B, A] }).ids).toEqual([
      A,
      B,
    ]);
  });

  it("rejects invalid items", () => {
    expect(schema.safeParse({ ids: "garbage" }).success).toBe(false);
    expect(schema.safeParse({ ids: [A, "garbage"] }).success).toBe(false);
  });
});

describe("IdParamsSchema", () => {
  it("rejects a malformed id", () => {
    expect(IdParamsSchema.safeParse({ id: "not-a-uuid" }).success).toBe(false);
    expect(IdParamsSchema.safeParse({ id: A }).success).toBe(true);
  });
});

describe("withId", () => {
  it("fills the id", () => {
    expect(withId(ApiPaths.lesson, "x")).toBe("/api/lessons/x");
  });
});

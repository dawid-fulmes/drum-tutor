import { describe, expect, it } from "vitest";
import { buildUrl } from "./api-client";

describe("buildUrl", () => {
  it("repeats array keys and omits empty values", () => {
    expect(
      buildUrl("/api/lessons", {
        page: 2,
        tagIds: ["a", "b"],
        q: "",
        sort: undefined,
        difficulties: [],
      }),
    ).toBe("/api/lessons?page=2&tagIds=a&tagIds=b");
  });

  it("adds no question mark when nothing remains", () => {
    expect(buildUrl("/api/tags")).toBe("/api/tags");
    expect(buildUrl("/api/tags", { q: "" })).toBe("/api/tags");
  });

  it("encodes values", () => {
    expect(buildUrl("/api/tags", { q: "a b&c" })).toBe("/api/tags?q=a+b%26c");
  });
});

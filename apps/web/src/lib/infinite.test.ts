import { describe, expect, it } from "vitest";
import { nextPageParam } from "./infinite";

describe("nextPageParam", () => {
  it("returns the next page while there are more pages", () => {
    expect(nextPageParam({ page: 1, totalPages: 2 })).toBe(2);
  });

  it("returns undefined on the last page", () => {
    expect(nextPageParam({ page: 2, totalPages: 2 })).toBeUndefined();
  });

  it("returns undefined when there are no pages", () => {
    expect(nextPageParam({ page: 1, totalPages: 0 })).toBeUndefined();
  });
});

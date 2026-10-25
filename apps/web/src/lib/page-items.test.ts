import { describe, expect, it } from "vitest";
import { pageItems } from "./page-items";

describe("pageItems", () => {
  it("returns a single page", () => {
    expect(pageItems(1, 1)).toEqual([1]);
  });

  it("lists every page when there are no gaps", () => {
    expect(pageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses long gaps into an ellipsis", () => {
    expect(pageItems(1, 12)).toEqual([1, 2, "ellipsis", 12]);
    expect(pageItems(6, 12)).toEqual([1, "ellipsis", 5, 6, 7, "ellipsis", 12]);
    expect(pageItems(12, 12)).toEqual([1, "ellipsis", 11, 12]);
  });

  it("shows a gap of exactly one page", () => {
    expect(pageItems(4, 12)).toEqual([1, 2, 3, 4, 5, "ellipsis", 12]);
  });

  it("returns nothing when there are no pages", () => {
    expect(pageItems(1, 0)).toEqual([]);
  });
});

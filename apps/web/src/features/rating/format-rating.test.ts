import { describe, expect, it } from "vitest";
import { formatRating } from "./format-rating";

describe("formatRating", () => {
  it("returns the same empty copy for both variants when there are no ratings", () => {
    const empty = { average: null, count: 0 };
    expect(formatRating(empty, "card")).toEqual({
      text: "No ratings yet",
      label: "No ratings yet",
    });
    expect(formatRating(empty, "page")).toEqual({
      text: "No ratings yet",
      label: "No ratings yet",
    });
  });

  it("formats the card summary with the count in parentheses", () => {
    expect(formatRating({ average: 4.33, count: 12 }, "card")).toEqual({
      text: "★ 4.3 (12)",
      label: "Rated 4.3 out of 5 from 12 ratings",
    });
  });

  it("formats the page summary with the count as ratings", () => {
    expect(formatRating({ average: 4.33, count: 12 }, "page")).toEqual({
      text: "★ 4.3 · 12 ratings",
      label: "Rated 4.3 out of 5 from 12 ratings",
    });
  });

  it("uses the singular for one rating and keeps one decimal", () => {
    expect(formatRating({ average: 5, count: 1 }, "page")).toEqual({
      text: "★ 5.0 · 1 rating",
      label: "Rated 5.0 out of 5 from 1 rating",
    });
  });

  it("rounds half up to one decimal", () => {
    const avg = (average: number) => formatRating({ average, count: 3 }, "card").text;
    expect(avg(4.25)).toBe("★ 4.3 (3)");
    expect(avg(4.35)).toBe("★ 4.4 (3)");
    expect(avg(2.05)).toBe("★ 2.1 (3)");
    expect(avg(1)).toBe("★ 1.0 (3)");
  });
});

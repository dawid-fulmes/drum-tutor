import { describe, expect, it } from "vitest";
import { toLocalDate } from "./local-date";

describe("toLocalDate", () => {
  // Built with local constructors, so the expectation holds in any time zone.
  it("returns the local calendar date", () => {
    expect(toLocalDate(new Date(2026, 9, 25, 23, 30))).toBe("2026-10-25");
    expect(toLocalDate(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });
});

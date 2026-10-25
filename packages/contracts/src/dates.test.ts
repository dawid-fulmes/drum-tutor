import { describe, expect, it } from "vitest";
import { daysBetween, LocalDateSchema } from "./dates";

describe("LocalDateSchema", () => {
  it.each(["2026-10-25", "2024-02-29"])("accepts %s", (date) => {
    expect(LocalDateSchema.safeParse(date).success).toBe(true);
  });

  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-1-5", "20261025", ""])(
    "rejects %j",
    (date) => {
      const result = LocalDateSchema.safeParse(date);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Date must be a valid YYYY-MM-DD date");
    },
  );
});

describe("daysBetween", () => {
  it("counts days across a DST change and a year end", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-01-02", "2026-01-01")).toBe(-1);
  });
});

describe("LocalDateSchema lower bound", () => {
  it.each(["0000-01-01", "0100-03-01", "1999-12-31"])("rejects %s, before 2000", (date) => {
    const result = LocalDateSchema.safeParse(date);
    expect(result.error?.issues[0]?.message).toBe("Date must be 2000-01-01 or later");
  });

  it("accepts 2000-01-01", () => {
    expect(LocalDateSchema.safeParse("2000-01-01").success).toBe(true);
  });
});

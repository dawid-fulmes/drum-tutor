import { describe, expect, it } from "vitest";
import { DailyStatsQuerySchema, WeeklyStatsQuerySchema } from "./stats";

const tagId = "11111111-1111-4111-8111-111111111111";
const daily = (from: string, to: string) =>
  DailyStatsQuerySchema.safeParse({ tagId, from, to }).success;
const weekly = (from: string, to: string) =>
  WeeklyStatsQuerySchema.safeParse({ tagId, from, to }).success;

describe("stats query schemas", () => {
  it("accept from = to and the maximum ranges", () => {
    expect(daily("2026-10-01", "2026-10-01")).toBe(true);
    expect(daily("2026-10-01", "2026-10-31")).toBe(true); // 31 days
    expect(weekly("2024-01-01", "2024-12-31")).toBe(true); // 366 days
  });

  it("reject 32 daily days and 367 weekly days, on path to", () => {
    const tooLongDaily = DailyStatsQuerySchema.safeParse({
      tagId,
      from: "2026-10-01",
      to: "2026-11-01",
    });
    expect(tooLongDaily.error?.issues[0]).toMatchObject({
      path: ["to"],
      message: "Range can be at most 31 days",
    });
    const tooLongWeekly = WeeklyStatsQuerySchema.safeParse({
      tagId,
      from: "2024-01-01",
      to: "2025-01-01",
    });
    expect(tooLongWeekly.error?.issues[0]).toMatchObject({
      path: ["to"],
      message: "Range can be at most 366 days",
    });
  });

  it("reject from after to, on path from", () => {
    const result = DailyStatsQuerySchema.safeParse({ tagId, from: "2026-10-02", to: "2026-10-01" });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["from"],
      message: "Start date must not be after end date",
    });
    expect(weekly("2026-10-02", "2026-10-01")).toBe(false);
  });

  it("reject malformed dates and a non-uuid tag", () => {
    expect(daily("2026-13-01", "2026-13-02")).toBe(false);
    expect(
      DailyStatsQuerySchema.safeParse({ tagId: "x", from: "2026-10-01", to: "2026-10-01" }).success,
    ).toBe(false);
  });
});

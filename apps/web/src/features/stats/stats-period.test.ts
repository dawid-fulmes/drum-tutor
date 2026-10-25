process.env.TZ = "America/Los_Angeles";

import { describe, expect, it } from "vitest";
import { isLatestPeriod, periodLabel, periodRange, shiftPeriod } from "./stats-period";

describe("test time zone", () => {
  it('runs west of UTC, where new Date("YYYY-MM-DD") would shift a day', () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBeGreaterThan(0);
  });
});

describe("periodRange", () => {
  it("covers the Monday–Sunday week of a date", () => {
    expect(periodRange("week", "2026-10-25")).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(periodRange("week", "2026-10-19")).toEqual({ from: "2026-10-19", to: "2026-10-25" });
    expect(periodRange("week", "2027-01-01")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
  });

  it("covers calendar months and years", () => {
    expect(periodRange("month", "2024-02-10")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(periodRange("year", "2026-06-15")).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });
});

describe("shiftPeriod", () => {
  it("returns the first day of the neighbouring period", () => {
    expect(shiftPeriod("week", "2026-12-30", 1)).toBe("2027-01-04");
    expect(shiftPeriod("week", "2026-10-21", -1)).toBe("2026-10-12");
    expect(shiftPeriod("month", "2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftPeriod("month", "2026-01-31", -1)).toBe("2025-12-01");
    expect(shiftPeriod("year", "2026-06-15", -1)).toBe("2025-01-01");
  });
});

describe("periodLabel", () => {
  it("labels weeks, months and years", () => {
    expect(periodLabel("week", "2026-10-22")).toBe("Oct 19 – Oct 25, 2026");
    expect(periodLabel("week", "2026-09-30")).toBe("Sep 28 – Oct 4, 2026");
    expect(periodLabel("week", "2027-01-01")).toBe("Dec 28, 2026 – Jan 3, 2027");
    expect(periodLabel("month", "2026-10-22")).toBe("October 2026");
    expect(periodLabel("year", "2026-10-22")).toBe("2026");
  });
});

describe("isLatestPeriod", () => {
  it("is true for the period containing today and later ones", () => {
    expect(isLatestPeriod("week", "2026-10-20", "2026-10-25")).toBe(true);
    expect(isLatestPeriod("week", "2026-10-12", "2026-10-25")).toBe(false);
    expect(isLatestPeriod("year", "2027-03-01", "2026-10-25")).toBe(true);
  });
});

process.env.TZ = "America/Los_Angeles";

import type { DailyStats, WeeklyStats } from "@drum-tutor/contracts";
import { describe, expect, it } from "vitest";
import { dailyRows, formatMinutes, toMinutes, weeklyRows } from "./chart-rows";

const TAG = "11111111-1111-4111-8111-111111111111";
const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function daily(from: string, seconds: number[]): DailyStats {
  const start = Date.parse(`${from}T00:00:00Z`);
  const days = seconds.map((s, i) => ({ date: iso(start + i * DAY_MS), seconds: s }));
  return { tagId: TAG, from, to: days.at(-1)?.date ?? from, days };
}

function year2026(): WeeklyStats {
  const weeks = [{ from: "2026-01-01", to: "2026-01-04", seconds: 60 }];
  for (
    let monday = Date.parse("2026-01-05T00:00:00Z");
    iso(monday) <= "2026-12-31";
    monday += 7 * DAY_MS
  ) {
    const sunday = iso(monday + 6 * DAY_MS);
    weeks.push({
      from: iso(monday),
      to: sunday > "2026-12-31" ? "2026-12-31" : sunday,
      seconds: 60,
    });
  }
  return { tagId: TAG, from: "2026-01-01", to: "2026-12-31", weeks };
}

describe("dailyRows", () => {
  const week = daily("2026-10-19", [0, 1500, 0, 750, 0, 0, 0]);

  it("labels weekdays, converts to minutes and blanks days after today", () => {
    expect(dailyRows("week", week, "2026-10-22").map((r) => [r.tick, r.minutes])).toEqual([
      ["Mon", 0],
      ["Tue", 25],
      ["Wed", 0],
      ["Thu", 12.5],
      ["Fri", null],
      ["Sat", null],
      ["Sun", null],
    ]);
  });

  it("labels the tooltip with the weekday and date", () => {
    expect(dailyRows("week", week, "2026-10-22")[5]?.tooltip).toBe("Sat, Oct 24");
    expect(dailyRows("week", week, "2026-10-22")[0]?.key).toBe("2026-10-19");
  });

  it("labels month days by number", () => {
    const october = daily(
      "2026-10-01",
      Array.from({ length: 31 }, () => 0),
    );
    const rows = dailyRows("month", october, "2026-12-01");
    expect(rows[0]?.tick).toBe("1");
    expect(rows[30]?.tick).toBe("31");
  });
});

describe("weeklyRows", () => {
  const rows = weeklyRows(year2026(), "2026-10-25");

  it("labels clipped weeks and ticks month starts", () => {
    expect(rows[0]?.tick).toBe("Jan");
    expect(rows[0]?.tooltip).toBe("Jan 1 – Jan 4");
    expect(rows.at(-1)?.tooltip).toBe("Dec 28 – Dec 31");
    expect(rows.filter((r) => r.tick !== "").map((r) => r.tick)).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]);
  });

  it("blanks weeks that start after today", () => {
    expect(rows.find((r) => r.key === "2026-10-26")?.minutes).toBeNull();
    expect(rows.find((r) => r.key === "2026-10-19")?.minutes).toBe(1);
  });
});

describe("minutes", () => {
  it("rounds to one decimal and formats", () => {
    expect(toMinutes(90)).toBe(1.5);
    expect(toMinutes(0)).toBe(0);
    expect(formatMinutes(25)).toBe("25 min");
    expect(formatMinutes(12.5)).toBe("12.5 min");
    expect(formatMinutes(0)).toBe("0 min");
  });
});

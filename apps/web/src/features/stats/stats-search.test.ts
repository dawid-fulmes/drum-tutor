process.env.TZ = "America/Los_Angeles";

import { describe, expect, it } from "vitest";
import { todayLocal } from "@/lib/local-date";
import { statsSearchSchema } from "./stats-search";

const A = "11111111-1111-4111-8111-111111111111";

describe("statsSearchSchema", () => {
  it("defaults to the current week without a tag", () => {
    expect(statsSearchSchema.parse({})).toEqual({
      tagId: undefined,
      period: "week",
      date: todayLocal(),
    });
  });

  it("falls back to defaults for garbage", () => {
    expect(statsSearchSchema.parse({ period: "decade", date: "2026-02-30", tagId: "x" })).toEqual({
      tagId: undefined,
      period: "week",
      date: todayLocal(),
    });
  });

  it("keeps valid values", () => {
    expect(statsSearchSchema.parse({ period: "year", date: "2025-03-04", tagId: A })).toEqual({
      tagId: A,
      period: "year",
      date: "2025-03-04",
    });
  });
});

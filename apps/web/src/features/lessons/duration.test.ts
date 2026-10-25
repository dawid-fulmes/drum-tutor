import { describe, expect, it } from "vitest";
import { formatDuration, formatDurationClock, stepDuration } from "./duration";

describe("formatDuration", () => {
  it("formats seconds as m:ss", () => {
    expect(formatDuration(300)).toBe("5:00");
    expect(formatDuration(30)).toBe("0:30");
    expect(formatDuration(3600)).toBe("60:00");
  });
});

describe("formatDurationClock", () => {
  it("formats seconds as MM:SS", () => {
    expect(formatDurationClock(180)).toBe("03:00");
    expect(formatDurationClock(3600)).toBe("60:00");
  });
});

describe("stepDuration", () => {
  it("moves by 30 seconds and clamps to the allowed range", () => {
    expect(stepDuration(180, 1)).toBe(210);
    expect(stepDuration(180, -1)).toBe(150);
    expect(stepDuration(30, -1)).toBe(30);
    expect(stepDuration(3600, 1)).toBe(3600);
  });
});

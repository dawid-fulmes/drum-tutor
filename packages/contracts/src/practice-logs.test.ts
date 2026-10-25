import { describe, expect, it } from "vitest";
import { PracticeLogInputSchema } from "./practice-logs";

const base = {
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  lessonId: "22222222-2222-4222-8222-222222222222",
  durationSeconds: 300,
  tempoBpm: 90,
  completedAt: "2026-10-25T21:30:00+02:00",
  localDate: "2026-10-25",
};

const ok = (override: Record<string, unknown>) =>
  PracticeLogInputSchema.safeParse({ ...base, ...override }).success;

describe("PracticeLogInputSchema", () => {
  it("accepts a valid log", () => {
    expect(ok({})).toBe(true);
  });

  it.each([30, 3600])("accepts duration %i", (duration) => {
    expect(ok({ durationSeconds: duration })).toBe(true);
  });

  it.each([0, 15, 45, 3630])("rejects duration %i", (duration) => {
    expect(ok({ durationSeconds: duration })).toBe(false);
  });

  it.each([29, 301])("rejects tempo %i", (tempo) => {
    expect(ok({ tempoBpm: tempo })).toBe(false);
  });

  it("rejects a non-uuid idempotency key", () => {
    expect(ok({ idempotencyKey: "abc" })).toBe(false);
  });

  it.each(["2026-10-25 21:30", "2026-10-25T21:30:00", "yesterday"])(
    "rejects completedAt %j with the copy message",
    (completedAt) => {
      const result = PracticeLogInputSchema.safeParse({ ...base, completedAt });
      expect(result.error?.issues[0]?.message).toBe(
        "Completion time must be an ISO 8601 date-time with offset",
      );
    },
  );

  it("accepts a UTC 'Z' completion time", () => {
    expect(ok({ completedAt: "2026-10-25T19:30:00Z" })).toBe(true);
  });

  it("accepts a local date one day off the UTC date (UTC−11 evening, UTC+14 morning)", () => {
    // UTC date is the 26th.
    expect(ok({ completedAt: "2026-10-25T23:30:00-11:00", localDate: "2026-10-25" })).toBe(true);
    // UTC date is the 25th.
    expect(ok({ completedAt: "2026-10-26T05:00:00+14:00", localDate: "2026-10-26" })).toBe(true);
  });

  it("rejects a local date two days off, on path localDate", () => {
    const result = PracticeLogInputSchema.safeParse({ ...base, localDate: "2026-10-27" });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["localDate"],
      message: "Local date must be within one day of the completion time",
    });
  });

  it("rejects an impossible local date", () => {
    expect(ok({ localDate: "2026-02-30" })).toBe(false);
  });

  it.each([
    ["0000-01-01T00:00:00Z", "1900-01-01"],
    ["0000-01-01T00:00:00+01:00", "1900-01-12"],
    ["1999-12-31T12:00:00Z", "1999-12-31"],
  ])("rejects a completion time %s before 2000", (completedAt, localDate) => {
    const result = PracticeLogInputSchema.safeParse({ ...base, completedAt, localDate });
    expect(result.error?.issues.map((i) => i.message)).toContain(
      "Completion time must be 2000-01-01 or later",
    );
  });
});

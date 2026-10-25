import { describe, expect, it } from "vitest";
import { clicksInWindow, planClicks, remainingSeconds } from "./click-schedule";

describe("click schedule", () => {
  const plan = planClicks({ startTime: 10, tempoBpm: 120, durationSeconds: 30 });

  it("starts the exercise after four count-in beats", () => {
    expect(plan).toMatchObject({ beatSeconds: 0.5, exerciseStart: 12, end: 42 });
  });

  it("accents the first count-in click and beat 1 of every bar", () => {
    expect(clicksInWindow(plan, 10, 13)).toEqual([
      { time: 10, accent: true, countIn: true },
      { time: 10.5, accent: false, countIn: true },
      { time: 11, accent: false, countIn: true },
      { time: 11.5, accent: false, countIn: true },
      { time: 12, accent: true, countIn: false },
      { time: 12.5, accent: false, countIn: false },
    ]);
    expect(clicksInWindow(plan, 13.9, 14.1).map((c) => c.accent)).toEqual([true]);
  });

  it("schedules nothing at or after the end", () => {
    expect(clicksInWindow(plan, 41, 50).map((c) => c.time)).toEqual([41, 41.5]);
  });

  it("does not drift at a tempo with a non-terminating beat length", () => {
    const slow = planClicks({ startTime: 0, tempoBpm: 90, durationSeconds: 30 });
    expect(clicksInWindow(slow, slow.exerciseStart, 1e9)).toHaveLength(45);
  });

  it("returns the window's clicks only once when windows are contiguous", () => {
    const first = clicksInWindow(plan, 10, 11.2);
    const second = clicksInWindow(plan, 11.2, 12.4);
    expect([...first, ...second].map((c) => c.time)).toEqual([10, 10.5, 11, 11.5, 12]);
  });

  it("counts down from the full duration once the exercise starts", () => {
    expect(remainingSeconds(plan, 11)).toBe(30);
    expect(remainingSeconds(plan, 12.2)).toBe(30);
    expect(remainingSeconds(plan, 41.5)).toBe(1);
    expect(remainingSeconds(plan, 43)).toBe(0);
  });
});

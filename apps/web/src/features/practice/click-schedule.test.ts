import { describe, expect, it } from "vitest";
import {
  clicksInWindow,
  countInNumber,
  currentBeat,
  notationVisual,
  planClicks,
  remainingSeconds,
} from "./click-schedule";

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

describe("visual beat", () => {
  const plan = planClicks({ startTime: 10, tempoBpm: 120, durationSeconds: 30 });

  it("counts the count-in down from 4 to 1, never below", () => {
    expect(
      [9.9, 10, 10.49, 10.5, 11, 11.5, 11.99, 12.3].map((t) => countInNumber(plan, t)),
    ).toEqual([4, 4, 4, 3, 2, 1, 1, 1]);
  });

  it("marks the current quarter note only between the exercise start and end", () => {
    expect(
      [11.99, 12, 12.49, 12.5, 13.5, 14, 41.99, 42, 50].map((t) => currentBeat(plan, t)),
    ).toEqual([null, 0, 0, 1, 3, 0, 3, null, null]);
  });

  it("shows the new beat on a frame exactly at its click", () => {
    expect(currentBeat(plan, plan.exerciseStart + 3 * plan.beatSeconds)).toBe(3);
    const slow = planClicks({ startTime: 0, tempoBpm: 90, durationSeconds: 30 });
    expect(currentBeat(slow, slow.exerciseStart + 7 * slow.beatSeconds)).toBe(3);
  });

  it("stops marking at an end between beats", () => {
    const odd = planClicks({ startTime: 0, tempoBpm: 70, durationSeconds: 30 });
    expect(currentBeat(odd, odd.end - 1e-6)).not.toBeNull();
    expect(currentBeat(odd, odd.end)).toBeNull();
  });
});

describe("notationVisual", () => {
  it("follows the clock, not the machine status, once the exercise has started", () => {
    expect(notationVisual("count-in", 3, null)).toEqual({ kind: "count-in", number: 3 });
    // The metronome loop has not dispatched count-in-done yet, but beat 1 has already sounded.
    expect(notationVisual("count-in", 1, 0)).toEqual({ kind: "playing", beat: 0 });
    expect(notationVisual("playing", 1, 2)).toEqual({ kind: "playing", beat: 2 });
    expect(notationVisual("playing", 1, null)).toEqual({ kind: "playing", beat: null });
  });

  it("is static outside a running session", () => {
    for (const status of ["setup", "saving", "save-failed", "saved", "save-rejected"] as const) {
      expect(notationVisual(status, 2, 1)).toEqual({ kind: "static" });
    }
  });
});

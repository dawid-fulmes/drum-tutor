import type { PracticeLog, PracticeLogInput } from "@drum-tutor/contracts";
import { describe, expect, it } from "vitest";
import {
  initialPracticeState,
  isRunning,
  isUnsaved,
  type PracticeState,
  practiceReducer,
} from "./practice-machine";

const settings = { tempoBpm: 90, durationSeconds: 300 };
const input: PracticeLogInput = {
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  lessonId: "22222222-2222-4222-8222-222222222222",
  durationSeconds: 300,
  tempoBpm: 90,
  completedAt: "2026-10-25T19:30:00.000Z",
  localDate: "2026-10-25",
};
const saved: PracticeLog = {
  id: "33333333-3333-4333-8333-333333333333",
  lessonId: input.lessonId,
  durationSeconds: 300,
  tempoBpm: 90,
  completedAt: input.completedAt,
  localDate: input.localDate,
};

const run = (...events: Parameters<typeof practiceReducer>[1][]) =>
  events.reduce(practiceReducer, initialPracticeState(settings));

describe("practiceReducer", () => {
  it("walks the happy path and keeps the settings for the next round", () => {
    const changed = { tempoBpm: 120, durationSeconds: 60 };
    const state = run(
      { type: "start", settings: changed },
      { type: "count-in-done" },
      { type: "complete", log: input },
      { type: "save-succeeded", log: saved },
    );
    expect(state).toEqual({ status: "saved", settings: changed, log: saved });
    expect(practiceReducer(state, { type: "practice-again" })).toEqual({
      status: "setup",
      settings: changed,
      stoppedInBackground: false,
    });
  });

  it("notes a background stop and clears the note on a user stop", () => {
    const background = run({ type: "start", settings }, { type: "stop", cause: "background" });
    expect(background).toEqual({ status: "setup", settings, stoppedInBackground: true });
    const user = run(
      { type: "start", settings },
      { type: "count-in-done" },
      { type: "stop", cause: "user" },
    );
    expect(user).toEqual({ status: "setup", settings, stoppedInBackground: false });
  });

  it("ignores stop outside count-in and playing", () => {
    const states: PracticeState[] = [
      initialPracticeState(settings),
      run({ type: "start", settings }, { type: "count-in-done" }, { type: "complete", log: input }),
      run(
        { type: "start", settings },
        { type: "count-in-done" },
        { type: "complete", log: input },
        { type: "save-failed" },
      ),
      run(
        { type: "start", settings },
        { type: "count-in-done" },
        { type: "complete", log: input },
        { type: "save-succeeded", log: saved },
      ),
    ];
    for (const state of states) {
      expect(practiceReducer(state, { type: "stop", cause: "background" })).toBe(state);
    }
  });

  it("completes only from playing", () => {
    const countIn = run({ type: "start", settings });
    expect(practiceReducer(countIn, { type: "complete", log: input })).toBe(countIn);
  });

  it("ignores a second start", () => {
    const countIn = run({ type: "start", settings });
    expect(practiceReducer(countIn, { type: "start", settings })).toBe(countIn);
  });

  it("retries with the same log and counts failures", () => {
    const saving = run(
      { type: "start", settings },
      { type: "count-in-done" },
      { type: "complete", log: input },
    );
    const once = practiceReducer(saving, { type: "save-failed" });
    expect(once).toMatchObject({ status: "save-failed", failures: 1, log: input });
    const retried = practiceReducer(once, { type: "retry" });
    expect(retried).toMatchObject({ status: "saving", failures: 1, log: input });
    expect(practiceReducer(retried, { type: "save-failed" })).toMatchObject({
      status: "save-failed",
      failures: 2,
      log: input,
    });
  });

  it("rejects a save with a reason and allows practising again", () => {
    const rejected = run(
      { type: "start", settings },
      { type: "count-in-done" },
      { type: "complete", log: input },
      { type: "save-rejected", reason: "This lesson is no longer available." },
    );
    expect(rejected).toEqual({
      status: "save-rejected",
      settings,
      reason: "This lesson is no longer available.",
    });
    expect(practiceReducer(rejected, { type: "practice-again" }).status).toBe("setup");
  });
});

describe("state predicates", () => {
  it("tells running and unsaved states apart", () => {
    const states = {
      setup: initialPracticeState(settings),
      countIn: run({ type: "start", settings }),
      playing: run({ type: "start", settings }, { type: "count-in-done" }),
      saving: run(
        { type: "start", settings },
        { type: "count-in-done" },
        { type: "complete", log: input },
      ),
    };
    const failed = practiceReducer(states.saving, { type: "save-failed" });
    const done = practiceReducer(states.saving, { type: "save-succeeded", log: saved });
    expect(
      [states.setup, states.countIn, states.playing, states.saving, failed, done].map(isRunning),
    ).toEqual([false, true, true, false, false, false]);
    expect(
      [states.setup, states.countIn, states.playing, states.saving, failed, done].map(isUnsaved),
    ).toEqual([false, false, false, true, true, false]);
  });
});

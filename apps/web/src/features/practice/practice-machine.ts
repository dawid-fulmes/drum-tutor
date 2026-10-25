import type { PracticeLog, PracticeLogInput } from "@drum-tutor/contracts";

export type PracticeSettings = { tempoBpm: number; durationSeconds: number };

/** The practice panel's states (spec §6.2). Nothing here is persisted or put in the URL. */
export type PracticeState =
  | { status: "setup"; settings: PracticeSettings; stoppedInBackground: boolean }
  | { status: "count-in"; settings: PracticeSettings }
  | { status: "playing"; settings: PracticeSettings }
  | { status: "saving"; settings: PracticeSettings; log: PracticeLogInput; failures: number }
  | { status: "save-failed"; settings: PracticeSettings; log: PracticeLogInput; failures: number }
  | { status: "saved"; settings: PracticeSettings; log: PracticeLog }
  | { status: "save-rejected"; settings: PracticeSettings; reason: string };

export type PracticeEvent =
  | { type: "start"; settings: PracticeSettings }
  | { type: "count-in-done" }
  | { type: "stop"; cause: "user" | "background" }
  | { type: "complete"; log: PracticeLogInput }
  | { type: "save-succeeded"; log: PracticeLog }
  | { type: "save-failed" }
  | { type: "retry" }
  | { type: "save-rejected"; reason: string }
  | { type: "practice-again" };

export function initialPracticeState(settings: PracticeSettings): PracticeState {
  return { status: "setup", settings, stoppedInBackground: false };
}

/** Events that do not apply to the current state return it unchanged (same reference). */
export function practiceReducer(state: PracticeState, event: PracticeEvent): PracticeState {
  switch (state.status) {
    case "setup":
      return event.type === "start" ? { status: "count-in", settings: event.settings } : state;
    case "count-in":
    case "playing":
      if (event.type === "stop") {
        // Stopped sessions leave no trace (R1); only the note about why differs.
        return {
          status: "setup",
          settings: state.settings,
          stoppedInBackground: event.cause === "background",
        };
      }
      if (state.status === "count-in" && event.type === "count-in-done") {
        return { status: "playing", settings: state.settings };
      }
      if (state.status === "playing" && event.type === "complete") {
        return { status: "saving", settings: state.settings, log: event.log, failures: 0 };
      }
      return state;
    case "saving":
      if (event.type === "save-succeeded") {
        return { status: "saved", settings: state.settings, log: event.log };
      }
      if (event.type === "save-failed") {
        return { ...state, status: "save-failed", failures: state.failures + 1 };
      }
      if (event.type === "save-rejected") {
        return { status: "save-rejected", settings: state.settings, reason: event.reason };
      }
      return state;
    case "save-failed":
      return event.type === "retry" ? { ...state, status: "saving" } : state;
    case "saved":
    case "save-rejected":
      return event.type === "practice-again" ? initialPracticeState(state.settings) : state;
  }
}

export function isRunning(state: PracticeState): boolean {
  return state.status === "count-in" || state.status === "playing";
}

/** A completed session whose log is not stored yet; leaving would lose it (ADR-0045). */
export function isUnsaved(state: PracticeState): boolean {
  return state.status === "saving" || state.status === "save-failed";
}

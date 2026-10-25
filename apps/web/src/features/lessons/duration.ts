import { DURATION_SECONDS } from "@drum-tutor/contracts";

const pad = (n: number) => String(n).padStart(2, "0");

/** `m:ss`, e.g. `5:00`. */
export function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`;
}

/** `MM:SS`, e.g. `03:00`. */
export function formatDurationClock(seconds: number): string {
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

/** Moves the duration by one step (30 s) and clamps it to the allowed range. */
export function stepDuration(seconds: number, direction: 1 | -1): number {
  const next = seconds + direction * DURATION_SECONDS.step;
  return Math.min(DURATION_SECONDS.max, Math.max(DURATION_SECONDS.min, next));
}

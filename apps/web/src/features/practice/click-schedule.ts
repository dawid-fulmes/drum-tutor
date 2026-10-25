/** Clicks before the exercise starts; they are not part of the duration (R2). */
export const COUNT_IN_BEATS = 4;

/** Times are seconds on the AudioContext clock (ADR-0016). */
export type ClickPlan = {
  startTime: number;
  tempoBpm: number;
  beatSeconds: number;
  exerciseStart: number;
  end: number;
  durationSeconds: number;
};

export type Click = { time: number; accent: boolean; countIn: boolean };

export function planClicks({
  startTime,
  tempoBpm,
  durationSeconds,
}: {
  startTime: number;
  tempoBpm: number;
  durationSeconds: number;
}): ClickPlan {
  const beatSeconds = 60 / tempoBpm;
  const exerciseStart = startTime + COUNT_IN_BEATS * beatSeconds;
  return {
    startTime,
    tempoBpm,
    beatSeconds,
    exerciseStart,
    end: exerciseStart + durationSeconds,
    durationSeconds,
  };
}

/**
 * Clicks with `from <= time < to`, ascending. Times come from beat indexes, never from accumulated
 * additions, so they do not drift; whether a beat is before the end is decided in integers.
 */
export function clicksInWindow(plan: ClickPlan, from: number, to: number): Click[] {
  const clicks: Click[] = [];
  for (let i = 0; i < COUNT_IN_BEATS; i++) {
    const time = plan.startTime + i * plan.beatSeconds;
    if (time >= from && time < to) clicks.push({ time, accent: i === 0, countIn: true });
  }
  const first = Math.max(0, Math.ceil((from - plan.exerciseStart) / plan.beatSeconds - 1e-9));
  // Beat k starts before the end exactly when k * 60 < durationSeconds * tempoBpm.
  for (let k = first; k * 60 < plan.durationSeconds * plan.tempoBpm; k++) {
    const time = plan.exerciseStart + k * plan.beatSeconds;
    if (time >= to) break;
    if (time >= from) clicks.push({ time, accent: k % 4 === 0, countIn: false });
  }
  return clicks;
}

/** Seconds left on the countdown: the full duration during count-in, then down to 0. */
export function remainingSeconds(plan: ClickPlan, now: number): number {
  if (now < plan.exerciseStart) return plan.durationSeconds;
  return Math.min(plan.durationSeconds, Math.max(0, Math.ceil(plan.end - now)));
}

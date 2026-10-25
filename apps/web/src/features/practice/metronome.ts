import { type ClickPlan, clicksInWindow, planClicks } from "./click-schedule";
import type { PracticeSettings } from "./practice-machine";

/** How often the look-ahead loop runs, and how far ahead it schedules (ADR-0016). */
const LOOP_MS = 25;
const LOOK_AHEAD_SECONDS = 0.1;
/** Gap between start() and the first click, so it is never scheduled in the past. */
const START_DELAY_SECONDS = 0.1;
const CLICK_SECONDS = 0.03;
const ACCENT_HZ = 1500;
const CLICK_HZ = 1000;

export type MetronomeCallbacks = {
  onCountInDone: () => void;
  onComplete: () => void;
  /** The AudioContext left "running" without stop() being called (e.g. the OS took the audio). */
  onInterrupted: () => void;
};

/**
 * A quarter-note click track scheduled on the audio clock: a short JS loop only decides which clicks
 * to schedule next, the AudioContext plays them on time. The exercise end is measured on the same
 * clock (ADR-0016).
 */
export class Metronome {
  private context: AudioContext | null = null;
  private loop: ReturnType<typeof setInterval> | null = null;
  private currentPlan: ClickPlan | null = null;
  private scheduledUntil = 0;
  private sources: OscillatorNode[] = [];
  private countInDone = false;
  private intentional = false;

  constructor(private readonly callbacks: MetronomeCallbacks) {}

  get plan(): ClickPlan | null {
    return this.currentPlan;
  }

  now(): number {
    return this.context?.currentTime ?? 0;
  }

  /**
   * Must be called from a user gesture (browsers keep audio suspended otherwise). Ignored while a
   * session runs. Rejects only when this session's audio could not start; a stop() while resuming
   * resolves quietly.
   */
  async start(settings: PracticeSettings): Promise<void> {
    if (this.context) return;
    const context = new AudioContext();
    this.context = context;
    this.intentional = false;
    this.countInDone = false;
    context.addEventListener("statechange", this.handleStateChange);
    try {
      await context.resume();
    } catch (error) {
      if (this.context !== context) return; // stopped while resuming: closing rejects resume()
      throw error;
    }
    if (this.context !== context) return;

    this.currentPlan = planClicks({
      startTime: context.currentTime + START_DELAY_SECONDS,
      tempoBpm: settings.tempoBpm,
      durationSeconds: settings.durationSeconds,
    });
    this.scheduledUntil = this.currentPlan.startTime;
    this.tick();
    this.loop = setInterval(this.tick, LOOP_MS);
  }

  /** Silences at once; safe to call any number of times. */
  stop(): void {
    this.intentional = true;
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Not started yet or already stopped.
      }
      source.disconnect();
    }
    this.sources = [];
    const context = this.context;
    this.context = null;
    this.currentPlan = null;
    if (context) {
      context.removeEventListener("statechange", this.handleStateChange);
      void context.close();
    }
  }

  private readonly tick = () => {
    const context = this.context;
    const plan = this.currentPlan;
    if (!context || !plan) return;
    const now = context.currentTime;

    const until = now + LOOK_AHEAD_SECONDS;
    for (const click of clicksInWindow(plan, this.scheduledUntil, until)) {
      this.schedule(context, click.time, click.accent);
    }
    this.scheduledUntil = Math.max(this.scheduledUntil, until);

    if (!this.countInDone && now >= plan.exerciseStart) {
      this.countInDone = true;
      this.callbacks.onCountInDone();
    }
    if (now >= plan.end) {
      this.stop();
      this.callbacks.onComplete();
    }
  };

  private schedule(context: AudioContext, time: number, accent: boolean) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = accent ? ACCENT_HZ : CLICK_HZ;
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + CLICK_SECONDS);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + CLICK_SECONDS);
    oscillator.addEventListener("ended", () => {
      this.sources = this.sources.filter((source) => source !== oscillator);
    });
    this.sources.push(oscillator);
  }

  private readonly handleStateChange = () => {
    if (this.intentional || !this.context || this.context.state === "running") return;
    this.stop();
    this.callbacks.onInterrupted();
  };
}

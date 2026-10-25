import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Metronome } from "./metronome";

/** Just enough of an AudioContext: resume stays pending until settled, close rejects it. */
class FakeAudioContext {
  static created = 0;
  currentTime = 0;
  state = "suspended";
  private rejectResume: ((error: Error) => void) | null = null;
  private resolveResume: (() => void) | null = null;
  constructor() {
    FakeAudioContext.created++;
    FakeAudioContext.last = this;
  }
  static last: FakeAudioContext | null = null;
  addEventListener() {}
  removeEventListener() {}
  resume() {
    return new Promise<void>((resolve, reject) => {
      this.resolveResume = resolve;
      this.rejectResume = reject;
    });
  }
  finishResume() {
    this.state = "running";
    this.resolveResume?.();
  }
  close() {
    this.state = "closed";
    this.rejectResume?.(new Error("InvalidStateError: context closed"));
    return Promise.resolve();
  }
}

const callbacks = () => ({ onCountInDone: vi.fn(), onComplete: vi.fn(), onInterrupted: vi.fn() });
const settings = { tempoBpm: 120, durationSeconds: 30 };

describe("Metronome.start", () => {
  beforeEach(() => {
    FakeAudioContext.created = 0;
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("resolves quietly when stopped while the audio is still resuming", async () => {
    const metronome = new Metronome(callbacks());
    const started = metronome.start(settings);
    metronome.stop();
    await expect(started).resolves.toBeUndefined();
    expect(metronome.plan).toBeNull();
  });

  it("ignores a second start while running instead of throwing", async () => {
    const metronome = new Metronome(callbacks());
    const first = metronome.start(settings);
    FakeAudioContext.last?.finishResume();
    await first;
    await expect(metronome.start(settings)).resolves.toBeUndefined();
    expect(FakeAudioContext.created).toBe(1);
    metronome.stop();
  });
});

import type { Instrument, SignatureV1 } from "@drum-tutor/contracts";
import { describe, expect, it } from "vitest";
import { layoutSignatureV1 } from "./notation-layout";

const CODES: Record<string, Instrument> = { H: "hihat-closed", S: "snare", K: "kick" };

/** The spec §5.1 grid notation, e.g. "HK H HS H …" or "S(R) -(L) …". */
function grid(text: string): SignatureV1 {
  return {
    version: "v1",
    slots: text.split(" ").map((token) => {
      const [, notes = "", comment = ""] = /^(-|[HSK]+)(?:\((.*)\))?$/.exec(token) ?? [];
      return {
        instruments: notes === "-" ? [] : [...notes].map((code) => CODES[code] as Instrument),
        comment,
      };
    }),
  };
}

describe("layoutSignatureV1", () => {
  const money = layoutSignatureV1(grid("HK H HS H HK H HS H"));

  it("lays out a money beat with beamed eighths", () => {
    expect(money.noteheads).toHaveLength(12);
    expect(money.noteheads.filter((n) => n.instrument === "hihat-closed")).toHaveLength(8);
    expect(money.noteheads.filter((n) => n.shape === "x")).toHaveLength(8);
    expect(money.noteheads.filter((n) => n.instrument === "kick")).toHaveLength(2);
    expect(money.noteheads.filter((n) => n.instrument === "snare")).toHaveLength(2);
    expect(money.stems).toHaveLength(8);
    expect(money.beams).toHaveLength(4);
    expect(money.flags).toHaveLength(0);
    expect(money.rests).toHaveLength(0);
  });

  it("places slots, beats, staff lines and instruments consistently", () => {
    const steps = money.slotX.slice(1).map((x, i) => x - (money.slotX[i] as number));
    expect(money.slotX).toHaveLength(8);
    expect(new Set(steps.map((s) => s.toFixed(6))).size).toBe(1);
    expect(money.beatX).toEqual([0, 2, 4, 6].map((i) => money.slotX[i]));
    const gaps = money.staffLines.slice(1).map((y, i) => y - (money.staffLines[i] as number));
    expect(money.staffLines).toHaveLength(5);
    expect(new Set(gaps.map((g) => g.toFixed(6))).size).toBe(1);
    const [top, second, third, fourth, bottom] = money.staffLines as [
      number,
      number,
      number,
      number,
      number,
    ];
    for (const n of money.noteheads) {
      if (n.instrument === "hihat-closed") expect(n.y).toBeLessThan(top);
      if (n.instrument === "snare") {
        expect(n.y).toBeGreaterThan(second);
        expect(n.y).toBeLessThan(third);
      }
      if (n.instrument === "kick") {
        expect(n.y).toBeGreaterThan(fourth);
        expect(n.y).toBeLessThan(bottom);
      }
    }
    const xs = [
      ...money.noteheads.map((n) => n.x),
      ...money.stems.map((s) => s.x),
      ...money.beams.flatMap((b) => [b.x1, b.x2]),
      ...money.counts.map((c) => c.x),
      money.staffLeft,
      money.staffRight,
      money.clefX,
      money.timeSignatureX,
    ];
    for (const x of xs) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(money.width);
    }
  });

  it("gives a lone eighth a flag and the empty slot an eighth rest", () => {
    const layout = layoutSignatureV1(grid("S - S S S S S S"));
    expect(layout.flags).toEqual([{ x: layout.stems[0]?.x, y: layout.stems[0]?.yTop }]);
    expect(layout.rests).toEqual([expect.objectContaining({ x: layout.slotX[1], kind: "eighth" })]);
    expect(layout.beams).toHaveLength(3);
    expect(layout.beams.every((b) => b.x1 > (layout.slotX[1] as number))).toBe(true);
  });

  it("draws a quarter rest for a fully empty beat", () => {
    const layout = layoutSignatureV1(grid("- - S S S S S S"));
    expect(layout.rests).toEqual([
      expect.objectContaining({ x: layout.beatX[0], kind: "quarter" }),
    ]);
    expect(layout.flags).toHaveLength(0);
  });

  it("draws four quarter rests for an empty signature", () => {
    const layout = layoutSignatureV1(grid("- - - - - - - -"));
    expect(layout.rests.map((r) => [r.x, r.kind])).toEqual(layout.beatX.map((x) => [x, "quarter"]));
    expect(layout.noteheads).toHaveLength(0);
    expect(layout.stems).toHaveLength(0);
    expect(layout.beams).toHaveLength(0);
    expect(layout.flags).toHaveLength(0);
  });

  it("puts three instruments on one stem spanning all noteheads", () => {
    const layout = layoutSignatureV1(grid("HSK S S S S S S S"));
    const first = layout.noteheads.filter((n) => n.x === layout.slotX[0]);
    expect(first).toHaveLength(3);
    const stem = layout.stems[0];
    const kick = first.find((n) => n.instrument === "kick");
    const hihat = first.find((n) => n.instrument === "hihat-closed");
    expect(stem?.yBottom).toBeGreaterThanOrEqual(kick?.y as number);
    expect(stem?.yTop).toBeLessThan(hihat?.y as number);
  });

  it("writes comments above stems and beams, also over a rest", () => {
    const strokes = layoutSignatureV1(grid("S(R) S(L) S(R) S(L) S(R) S(L) S(R) S(L)"));
    expect(strokes.comments.map((c) => c.text)).toEqual(["R", "L", "R", "L", "R", "L", "R", "L"]);
    const highest = Math.min(...strokes.beams.map((b) => b.y), ...strokes.stems.map((s) => s.yTop));
    for (const c of strokes.comments) expect(c.y).toBeLessThan(highest);
    const overRest = layoutSignatureV1(grid("-(R) S S S S S S S"));
    expect(overRest.comments).toEqual([
      expect.objectContaining({ x: overRest.slotX[0], text: "R" }),
    ]);
  });

  it("counts every slot under the staff", () => {
    expect(money.counts.map((c) => c.text)).toEqual(["1", "&", "2", "&", "3", "&", "4", "&"]);
    expect(money.counts.map((c) => c.x)).toEqual(money.slotX);
    for (const c of money.counts) expect(c.y).toBeGreaterThan(money.staffLines[4] as number);
  });

  it("places one highlight band per beat, centred on the beat and covering the staff", () => {
    expect(money.highlights).toHaveLength(4);
    money.highlights.forEach((h, beat) => {
      expect(h.x + h.width / 2).toBeCloseTo(money.beatX[beat] as number);
      expect(h.y).toBeLessThan(money.staffLines[0] as number);
      expect(h.y + h.height).toBeGreaterThan(money.staffLines[4] as number);
    });
  });

  it("places the clef bars and the 4/4 inside the staff", () => {
    expect(money.clefBars).toHaveLength(2);
    expect(money.timeSignature.map((t) => t.text)).toEqual(["4", "4"]);
    for (const bar of money.clefBars) {
      expect(bar.y).toBeGreaterThanOrEqual(money.staffLines[0] as number);
      expect(bar.y + bar.height).toBeLessThanOrEqual(money.staffLines[4] as number);
    }
    for (const t of money.timeSignature) {
      expect(t.y).toBeGreaterThan(money.staffLines[0] as number);
      expect(t.y).toBeLessThanOrEqual(money.staffLines[4] as number);
    }
  });
});

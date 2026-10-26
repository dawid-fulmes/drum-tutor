import { EMPTY_SIGNATURE_V1 } from "@drum-tutor/contracts";
import { describe, expect, it } from "vitest";
import {
  COLUMN_HEADERS,
  INSTRUMENT_LABELS,
  SLOT_LABELS,
  setComment,
  toggleInstrument,
} from "./signature-edit";

describe("toggleInstrument", () => {
  it("adds and removes an instrument in one slot", () => {
    const on = toggleInstrument(EMPTY_SIGNATURE_V1, 3, "snare");
    expect(on.slots.map((s) => s.instruments)).toEqual([[], [], [], ["snare"], [], [], [], []]);
    expect(toggleInstrument(on, 3, "snare").slots[3]?.instruments).toEqual([]);
  });

  it("never mutates its input, including the shared empty signature", () => {
    const before = structuredClone(EMPTY_SIGNATURE_V1);
    const on = toggleInstrument(EMPTY_SIGNATURE_V1, 0, "kick");
    setComment(on, 0, "R");
    toggleInstrument(on, 0, "kick");
    expect(EMPTY_SIGNATURE_V1).toEqual(before);
    expect(on.slots[0]).toEqual({ instruments: ["kick"], comment: "" });
  });

  it("returns new references only for what changed", () => {
    const next = toggleInstrument(EMPTY_SIGNATURE_V1, 2, "kick");
    expect(next).not.toBe(EMPTY_SIGNATURE_V1);
    expect(next.slots).not.toBe(EMPTY_SIGNATURE_V1.slots);
    expect(next.slots[2]).not.toBe(EMPTY_SIGNATURE_V1.slots[2]);
    expect(next.slots[1]).toBe(EMPTY_SIGNATURE_V1.slots[1]);
  });

  it("keeps instruments in display order", () => {
    const kickFirst = toggleInstrument(EMPTY_SIGNATURE_V1, 0, "kick");
    const both = toggleInstrument(kickFirst, 0, "hihat-closed");
    expect(both.slots[0]?.instruments).toEqual(["hihat-closed", "kick"]);
    expect(toggleInstrument(both, 0, "snare").slots[0]?.instruments).toEqual([
      "hihat-closed",
      "snare",
      "kick",
    ]);
  });
});

describe("setComment", () => {
  it("sets one slot's comment and leaves the input unchanged", () => {
    const next = setComment(EMPTY_SIGNATURE_V1, 0, "R");
    expect(next.slots[0]?.comment).toBe("R");
    expect(next.slots[1]).toBe(EMPTY_SIGNATURE_V1.slots[1]);
    expect(EMPTY_SIGNATURE_V1.slots[0]?.comment).toBe("");
  });
});

describe("labels", () => {
  it("names slots, columns and instruments", () => {
    expect(SLOT_LABELS).toEqual(["1", "1&", "2", "2&", "3", "3&", "4", "4&"]);
    expect(COLUMN_HEADERS).toEqual(["1", "&", "2", "&", "3", "&", "4", "&"]);
    expect(INSTRUMENT_LABELS).toEqual({
      "hihat-closed": "Hi-hat (closed)",
      snare: "Snare",
      kick: "Kick",
    });
  });
});

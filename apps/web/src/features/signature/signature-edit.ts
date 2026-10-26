import { INSTRUMENTS, type Instrument, type SignatureV1 } from "@drum-tutor/contracts";

/** Accessible slot names: "Snare on 2&". */
export const SLOT_LABELS = ["1", "1&", "2", "2&", "3", "3&", "4", "4&"] as const;
/** The editor's column headers (spec §7.3). */
export const COLUMN_HEADERS = ["1", "&", "2", "&", "3", "&", "4", "&"] as const;

export const INSTRUMENT_LABELS: Record<Instrument, string> = {
  "hihat-closed": "Hi-hat (closed)",
  snare: "Snare",
  kick: "Kick",
};

function updateSlot(
  signature: SignatureV1,
  index: number,
  update: (slot: SignatureV1["slots"][number]) => SignatureV1["slots"][number],
): SignatureV1 {
  return {
    ...signature,
    slots: signature.slots.map((slot, i) => (i === index ? update(slot) : slot)),
  };
}

/**
 * Adds or removes an instrument in one slot, keeping display order. Returns a new signature and
 * never mutates its input, so the shared `EMPTY_SIGNATURE_V1` default stays empty.
 */
export function toggleInstrument(
  signature: SignatureV1,
  slot: number,
  instrument: Instrument,
): SignatureV1 {
  return updateSlot(signature, slot, (current) => {
    const has = current.instruments.includes(instrument);
    return {
      ...current,
      instruments: INSTRUMENTS.filter((i) =>
        i === instrument ? !has : current.instruments.includes(i),
      ),
    };
  });
}

/** Sets one slot's raw comment; the contract schema trims it on submit. */
export function setComment(signature: SignatureV1, slot: number, comment: string): SignatureV1 {
  return updateSlot(signature, slot, (current) => ({ ...current, comment }));
}

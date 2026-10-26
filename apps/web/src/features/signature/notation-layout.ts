import { type Instrument, SIGNATURE_V1_SLOTS, type SignatureV1 } from "@drum-tutor/contracts";

export type NoteheadGlyph = { x: number; y: number; instrument: Instrument; shape: "x" | "filled" };
export type StemGlyph = { x: number; yTop: number; yBottom: number };
export type BeamGlyph = { x1: number; x2: number; y: number };
/** Attached at the stem top. */
export type FlagGlyph = { x: number; y: number };
export type RestGlyph = { x: number; y: number; kind: "eighth" | "quarter" };
export type TextGlyph = { x: number; y: number; text: string };
export type BoxGlyph = { x: number; y: number; width: number; height: number };

/** Everything needed to draw one bar, in the coordinate space of an SVG viewBox (ADR-0052). */
export type NotationLayout = {
  width: number;
  height: number;
  /** Five y values, top to bottom. */
  staffLines: number[];
  staffLeft: number;
  /** The final barline. */
  staffRight: number;
  clefX: number;
  timeSignatureX: number;
  /** The percussion clef: two short thick bars. */
  clefBars: BoxGlyph[];
  /** "4" over "4". */
  timeSignature: TextGlyph[];
  /** Eight equally spaced slot centres. */
  slotX: number[];
  /** The first slot of each quarter note: where rests and the beat highlight go. */
  beatX: number[];
  /** One band per beat, behind the staff, for the playing highlight (ADR-0054). */
  highlights: BoxGlyph[];
  noteheads: NoteheadGlyph[];
  stems: StemGlyph[];
  beams: BeamGlyph[];
  flags: FlagGlyph[];
  rests: RestGlyph[];
  comments: TextGlyph[];
  counts: TextGlyph[];
};

const WIDTH = 540;
const HEIGHT = 124;
const STAFF_TOP = 50;
const LINE_GAP = 10;
const STAFF_LEFT = 10;
const STAFF_RIGHT = 530;
const CLEF_X = 28;
const TIME_SIGNATURE_X = 62;
const FIRST_SLOT_X = 120;
const SLOT_STEP = 54;
/** Stems sit on the right side of the notehead, all ending at one height so beams are level. */
const STEM_OFFSET = 6;
const STEM_TOP = 18;
const COMMENT_Y = 12;
const COUNT_Y = 116;
const REST_Y = STAFF_TOP + 2 * LINE_GAP;
const CLEF_BAR_WIDTH = 4;
const HIGHLIGHT_WIDTH = 32;
const HIGHLIGHT_TOP = 2;
const HIGHLIGHT_BOTTOM = STAFF_TOP + 4 * LINE_GAP + 12;
const COUNT_LABELS = ["1", "&", "2", "&", "3", "&", "4", "&"];

/** Spec §7.1: hi-hat in the space above the staff, snare in the third space, kick in the bottom one. */
const INSTRUMENT_Y: Record<Instrument, number> = {
  "hihat-closed": STAFF_TOP - LINE_GAP / 2,
  snare: STAFF_TOP + 1.5 * LINE_GAP,
  kick: STAFF_TOP + 3.5 * LINE_GAP,
};

export function layoutSignatureV1(signature: SignatureV1): NotationLayout {
  const slotX = Array.from({ length: SIGNATURE_V1_SLOTS }, (_, i) => FIRST_SLOT_X + i * SLOT_STEP);
  const beatX = slotX.filter((_, i) => i % 2 === 0);
  const filled = signature.slots.map((slot) => slot.instruments.length > 0);
  const stemX = (slot: number) => (slotX[slot] as number) + STEM_OFFSET;

  const layout: NotationLayout = {
    width: WIDTH,
    height: HEIGHT,
    staffLines: Array.from({ length: 5 }, (_, i) => STAFF_TOP + i * LINE_GAP),
    staffLeft: STAFF_LEFT,
    staffRight: STAFF_RIGHT,
    clefX: CLEF_X,
    timeSignatureX: TIME_SIGNATURE_X,
    clefBars: [CLEF_X - 6, CLEF_X + 2].map((x) => ({
      x,
      y: STAFF_TOP + LINE_GAP,
      width: CLEF_BAR_WIDTH,
      height: 2 * LINE_GAP,
    })),
    timeSignature: [STAFF_TOP + 2 * LINE_GAP - 1, STAFF_TOP + 4 * LINE_GAP - 1].map((y) => ({
      x: TIME_SIGNATURE_X,
      y,
      text: "4",
    })),
    slotX,
    beatX,
    highlights: beatX.map((x) => ({
      x: x - HIGHLIGHT_WIDTH / 2,
      y: HIGHLIGHT_TOP,
      width: HIGHLIGHT_WIDTH,
      height: HIGHLIGHT_BOTTOM - HIGHLIGHT_TOP,
    })),
    noteheads: [],
    stems: [],
    beams: [],
    flags: [],
    rests: [],
    comments: [],
    counts: COUNT_LABELS.map((text, i) => ({ x: slotX[i] as number, y: COUNT_Y, text })),
  };

  signature.slots.forEach((slot, i) => {
    const x = slotX[i] as number;
    if (slot.comment) layout.comments.push({ x, y: COMMENT_Y, text: slot.comment });
    if (slot.instruments.length === 0) return;
    for (const instrument of slot.instruments) {
      layout.noteheads.push({
        x,
        y: INSTRUMENT_Y[instrument],
        instrument,
        shape: instrument === "hihat-closed" ? "x" : "filled",
      });
    }
    const lowest = Math.max(...slot.instruments.map((instrument) => INSTRUMENT_Y[instrument]));
    layout.stems.push({ x: stemX(i), yTop: STEM_TOP, yBottom: lowest });
  });

  for (let beat = 0; beat < SIGNATURE_V1_SLOTS / 2; beat++) {
    const first = beat * 2;
    const second = first + 1;
    if (filled[first] && filled[second]) {
      layout.beams.push({ x1: stemX(first), x2: stemX(second), y: STEM_TOP });
    } else if (!filled[first] && !filled[second]) {
      layout.rests.push({ x: beatX[beat] as number, y: REST_Y, kind: "quarter" });
    } else {
      const note = filled[first] ? first : second;
      const rest = filled[first] ? second : first;
      layout.flags.push({ x: stemX(note), y: STEM_TOP });
      layout.rests.push({ x: slotX[rest] as number, y: REST_Y, kind: "eighth" });
    }
  }

  return layout;
}

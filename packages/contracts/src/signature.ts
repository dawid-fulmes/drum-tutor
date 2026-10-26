import { z } from "zod";

/** Instruments of signature v1, in display order from the top of the staff (ADR-0051). */
export const INSTRUMENTS = ["hihat-closed", "snare", "kick"] as const;
export const InstrumentSchema = z.enum(INSTRUMENTS, { error: "Unknown instrument" });
export type Instrument = z.infer<typeof InstrumentSchema>;

export const SIGNATURE_V1_SLOTS = 8;
export const SIGNATURE_COMMENT_MAX = 3;

export const SignatureSlotV1Schema = z.object({
  instruments: z
    .array(InstrumentSchema)
    .refine(
      (list) => new Set(list).size === list.length,
      "An instrument can only appear once in a slot",
    ),
  comment: z.string().trim().max(SIGNATURE_COMMENT_MAX, "A comment can be at most 3 characters"),
});
export type SignatureSlotV1 = z.infer<typeof SignatureSlotV1Schema>;

/** One 4/4 bar of eighth-note slots; slot 0 is beat 1 (ADR-0051). */
export const SignatureV1Schema = z.object({
  version: z.literal("v1"),
  slots: z
    .array(SignatureSlotV1Schema)
    .length(SIGNATURE_V1_SLOTS, "A signature has exactly 8 slots"),
});
export type SignatureV1 = z.infer<typeof SignatureV1Schema>;

/** Every format version is a member of this union; stored lessons keep their version (ADR-0050). */
export const SignatureSchema = z.discriminatedUnion("version", [SignatureV1Schema]);
export type Signature = z.infer<typeof SignatureSchema>;

export const EMPTY_SIGNATURE_V1: SignatureV1 = {
  version: "v1",
  slots: Array.from({ length: SIGNATURE_V1_SLOTS }, () => ({ instruments: [], comment: "" })),
};

/** A lesson can be published only when this is true (ADR-0053). */
export function signatureHasNotes(signature: Signature): boolean {
  return signature.slots.some((slot) => slot.instruments.length > 0);
}

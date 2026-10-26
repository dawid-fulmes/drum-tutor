import { ApiErrorCode, type Signature, SignatureSchema } from "@drum-tutor/contracts";
import type { LessonSignatureJson } from "@drum-tutor/db";
import { AppError } from "../../plugins/error-handler";

/** Stored JSON is parsed on every read, so a value that drifted from the contract is a 500, never passed on (ADR-0050). */
export function toSignature(json: LessonSignatureJson): Signature {
  return SignatureSchema.parse(json);
}

export const signatureEmpty = () =>
  new AppError(
    409,
    ApiErrorCode.SIGNATURE_EMPTY,
    "Add at least one note to the signature before publishing",
  );

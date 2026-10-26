import {
  INSTRUMENTS,
  type Signature,
  type SignatureV1,
  signatureHasNotes,
} from "@drum-tutor/contracts";
import type { AnyFieldApi } from "@tanstack/react-form";
import { cn } from "cn";
import type { ReactElement } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toggle } from "@/components/ui/toggle";
import {
  COLUMN_HEADERS,
  INSTRUMENT_LABELS,
  SLOT_LABELS,
  setComment,
  toggleInstrument,
} from "@/features/signature/signature-edit";
import { SignatureNotation } from "@/features/signature/signature-notation";

type SignatureFieldProps = { field: AnyFieldApi; disabled?: boolean };

function errorMessage(error: unknown): string | undefined {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return undefined;
}

/** Beat columns (1, 2, 3, 4) get a stronger border than the "&" columns. */
const beatBorder = (slot: number) => (slot % 2 === 0 ? "border-foreground/40" : "border-input");

/** The signature section of the lesson form: one editor per format version (spec §4.2, §7.3). */
export function SignatureField({ field, disabled }: SignatureFieldProps): ReactElement {
  const value: Signature = field.state.value;
  switch (value.version) {
    case "v1":
      return <SignatureV1Editor field={field} value={value} disabled={disabled} />;
  }
}

/** The grid editor for signature v1 with a live notation preview. */
function SignatureV1Editor({
  field,
  value,
  disabled,
}: SignatureFieldProps & { value: SignatureV1 }) {
  const error = field.state.meta.isTouched ? errorMessage(field.state.meta.errors[0]) : undefined;
  const change = (next: SignatureV1) => field.handleChange(next);

  return (
    <fieldset className="grid gap-3">
      <Label asChild>
        <legend>Signature</legend>
      </Label>
      <div className="grid grid-cols-[8rem_repeat(8,minmax(0,2.75rem))] items-center gap-1">
        <span />
        {COLUMN_HEADERS.map((header, slot) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: the 8 columns are fixed
            key={slot}
            className={cn(
              "text-center text-sm",
              slot % 2 === 0 ? "font-medium" : "text-muted-foreground",
            )}
          >
            {header}
          </span>
        ))}

        {INSTRUMENTS.map((instrument) => (
          <div key={instrument} className="contents">
            <span className="text-sm">{INSTRUMENT_LABELS[instrument]}</span>
            {value.slots.map((slot, i) => (
              <Toggle
                // biome-ignore lint/suspicious/noArrayIndexKey: the 8 slots are fixed
                key={i}
                variant="outline"
                aria-label={`${INSTRUMENT_LABELS[instrument]} on ${SLOT_LABELS[i]}`}
                className={cn(
                  "h-9 w-full data-[state=on]:bg-foreground data-[state=on]:text-background data-[state=on]:hover:bg-foreground/85",
                  beatBorder(i),
                )}
                pressed={slot.instruments.includes(instrument)}
                disabled={disabled}
                onPressedChange={() => change(toggleInstrument(value, i, instrument))}
              />
            ))}
          </div>
        ))}

        <span className="text-sm">Comment</span>
        {value.slots.map((slot, i) => (
          <Input
            // biome-ignore lint/suspicious/noArrayIndexKey: the 8 slots are fixed
            key={i}
            aria-label={`Comment on ${SLOT_LABELS[i]}`}
            maxLength={3}
            className={cn("h-9 px-1 text-center", beatBorder(i))}
            value={slot.comment}
            disabled={disabled}
            onChange={(event) => change(setComment(value, i, event.target.value))}
            onBlur={field.handleBlur}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        An empty column is a rest. Comments are optional, e.g. R or L.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {signatureHasNotes(value) ? null : (
        <p className="text-sm text-muted-foreground">Add at least one note before publishing.</p>
      )}
      <div className="grid gap-2">
        <span className="text-sm font-medium">Preview</span>
        <div className="rounded-xl border p-4">
          <SignatureNotation signature={value} />
        </div>
      </div>
    </fieldset>
  );
}

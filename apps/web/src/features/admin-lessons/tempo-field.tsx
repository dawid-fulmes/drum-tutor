import { TEMPO_BPM } from "@drum-tutor/contracts";
import type { AnyFieldApi } from "@tanstack/react-form";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

type TempoFieldProps = { field: AnyFieldApi; disabled?: boolean };

function errorMessage(error: unknown): string | undefined {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return undefined;
}

/** Slider and number Input kept in sync; the slider keeps the last valid value while the typed one is invalid. */
export function TempoField({ field, disabled }: TempoFieldProps) {
  const value: number = field.state.value;
  const [text, setText] = useState(Number.isNaN(value) ? "" : String(value));
  const [lastValid, setLastValid] = useState(value);
  const error = field.state.meta.isTouched ? errorMessage(field.state.meta.errors[0]) : undefined;
  const errorId = `${field.name}-error`;

  const inRange = Number.isInteger(value) && value >= TEMPO_BPM.min && value <= TEMPO_BPM.max;
  const sliderValue = inRange ? value : lastValid;

  const setValue = (next: number) => {
    field.handleChange(next);
    if (Number.isInteger(next) && next >= TEMPO_BPM.min && next <= TEMPO_BPM.max) {
      setLastValid(next);
    }
  };

  return (
    <div className="grid gap-2">
      <Label htmlFor={field.name}>Tempo</Label>
      <div className="flex items-center gap-4">
        <Slider
          aria-label="Tempo"
          min={TEMPO_BPM.min}
          max={TEMPO_BPM.max}
          step={1}
          value={[sliderValue]}
          disabled={disabled}
          onValueChange={([next]) => {
            setText(String(next));
            setValue(next as number);
          }}
          onValueCommit={() => field.handleBlur()}
        />
        <div className="flex shrink-0 items-center gap-2">
          <Input
            id={field.name}
            name={field.name}
            type="number"
            inputMode="numeric"
            className="w-20"
            value={text}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onBlur={field.handleBlur}
            onChange={(event) => {
              setText(event.target.value);
              setValue(event.target.value === "" ? Number.NaN : Number(event.target.value));
            }}
          />
          <span className="text-sm text-muted-foreground">BPM</span>
        </div>
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

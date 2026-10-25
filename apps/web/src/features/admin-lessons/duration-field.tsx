import { DURATION_SECONDS } from "@drum-tutor/contracts";
import type { AnyFieldApi } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDurationClock, stepDuration } from "@/features/lessons/duration";

type DurationFieldProps = { field: AnyFieldApi; disabled?: boolean };

/** Read-only `MM:SS` between "−" and "+" buttons; there is no typing. */
export function DurationField({ field, disabled }: DurationFieldProps) {
  const value: number = field.state.value;
  const change = (direction: 1 | -1) => field.handleChange(stepDuration(value, direction));

  return (
    <fieldset className="grid gap-2">
      <Label asChild>
        <legend>Duration</legend>
      </Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Decrease duration by 30 seconds"
          disabled={disabled || value <= DURATION_SECONDS.min}
          onClick={() => change(-1)}
        >
          <span aria-hidden>−</span>
        </Button>
        <output
          aria-live="polite"
          className="w-16 text-center font-mono text-lg tabular-nums"
          data-testid="duration-value"
        >
          {formatDurationClock(value)}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Increase duration by 30 seconds"
          disabled={disabled || value >= DURATION_SECONDS.max}
          onClick={() => change(1)}
        >
          <span aria-hidden>+</span>
        </Button>
      </div>
    </fieldset>
  );
}

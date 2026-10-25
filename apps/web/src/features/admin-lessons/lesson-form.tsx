import {
  DIFFICULTIES,
  type Difficulty,
  type LessonInput,
  LessonInputSchema,
} from "@drum-tutor/contracts";
import { type AnyFieldApi, useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatDifficulty } from "@/features/lessons/format";
import { SelectedTags } from "@/features/tags/selected-tags";
import { TagPicker } from "@/features/tags/tag-picker";
import { DurationField } from "./duration-field";
import { TempoField } from "./tempo-field";

export type LessonFormValues = Omit<LessonInput, "difficulty"> & { difficulty: Difficulty | "" };

export const NEW_LESSON_DEFAULTS: LessonFormValues = {
  name: "",
  description: "",
  difficulty: "",
  tagIds: [],
  recommendedTempoBpm: 60,
  recommendedDurationSeconds: 180,
};

type LessonFormProps = {
  defaultValues: LessonFormValues;
  disabled?: boolean;
  pending?: boolean;
  submitLabel: string;
  onSubmit: (input: LessonInput) => void;
  onCancel: () => void;
};

function errorMessage(error: unknown): string | undefined {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return undefined;
}

const shape = LessonInputSchema.shape;

/**
 * A submit validates every field on all causes, so stale `onBlur`/`onSubmit` errors would outlive a
 * fixed value. Editing a field drops them; its `onChange` validator then reports whatever is still wrong.
 */
const clearStaleErrors = {
  onChange: ({ fieldApi }: { fieldApi: AnyFieldApi }) =>
    fieldApi.setMeta((meta) => ({
      ...meta,
      errorMap: { ...meta.errorMap, onBlur: undefined, onSubmit: undefined },
    })),
};

/**
 * Tempo keeps its blur/submit error until the typed value is valid; an `onChange` validator would
 * flash an error while typing "120" ("1", "12" are out of range).
 */
const clearTempoErrorWhenValid = {
  onChange: ({ value, fieldApi }: { value: unknown; fieldApi: AnyFieldApi }) => {
    if (!shape.recommendedTempoBpm.safeParse(value).success) return;
    fieldApi.setMeta((meta) => ({
      ...meta,
      errorMap: { ...meta.errorMap, onBlur: undefined, onSubmit: undefined },
    }));
  },
};

export function LessonForm({
  defaultValues,
  disabled,
  pending,
  submitLabel,
  onSubmit,
  onCancel,
}: LessonFormProps) {
  const form = useForm({
    defaultValues,
    validators: { onSubmit: LessonInputSchema },
    onSubmit: ({ value }) => onSubmit(LessonInputSchema.parse(value)),
  });
  const locked = disabled || pending;
  // Validation is async, so `pending` lags behind a fast double click.
  const submitting = useRef(false);
  useEffect(() => {
    if (!pending) submitting.current = false;
  }, [pending]);

  return (
    <form
      noValidate
      className="grid max-w-2xl gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (locked || submitting.current) return;
        submitting.current = true;
        void form.handleSubmit().finally(() => {
          if (!form.state.isValid) submitting.current = false;
        });
      }}
    >
      <form.Field
        name="name"
        validators={{ onChange: shape.name, onBlur: shape.name }}
        listeners={clearStaleErrors}
      >
        {(field) => <TextField field={field} label="Name" disabled={locked} />}
      </form.Field>

      <form.Field
        name="description"
        validators={{ onChange: shape.description, onBlur: shape.description }}
        listeners={clearStaleErrors}
      >
        {(field) => <TextField field={field} label="Description" multiline disabled={locked} />}
      </form.Field>

      <form.Field
        name="difficulty"
        validators={{ onChange: shape.difficulty, onBlur: shape.difficulty }}
        listeners={clearStaleErrors}
      >
        {(field) => {
          const error = field.state.meta.isTouched
            ? errorMessage(field.state.meta.errors[0])
            : undefined;
          return (
            <div className="grid gap-2">
              <Label id="difficulty-label">Difficulty</Label>
              <RadioGroup
                aria-labelledby="difficulty-label"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "difficulty-error" : undefined}
                className="flex flex-wrap gap-4"
                value={field.state.value}
                disabled={locked}
                onValueChange={(next) => field.handleChange(next as Difficulty)}
              >
                {DIFFICULTIES.map((difficulty) => (
                  <div key={difficulty} className="flex items-center gap-2">
                    <RadioGroupItem
                      id={`difficulty-${difficulty}`}
                      value={difficulty}
                      aria-invalid={error ? true : undefined}
                    />
                    <Label htmlFor={`difficulty-${difficulty}`}>
                      {formatDifficulty(difficulty)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {error ? (
                <p id="difficulty-error" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>
          );
        }}
      </form.Field>

      <form.Field
        name="tagIds"
        validators={{ onChange: shape.tagIds, onBlur: shape.tagIds }}
        listeners={clearStaleErrors}
      >
        {(field) => {
          const error = field.state.meta.isTouched
            ? errorMessage(field.state.meta.errors[0])
            : undefined;
          return (
            <div className="grid gap-2">
              <Label>Tags</Label>
              <div>
                <TagPicker
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled={locked}
                  invalid={Boolean(error)}
                />
              </div>
              <SelectedTags
                ids={field.state.value}
                disabled={locked}
                onRemove={(id) =>
                  field.handleChange(field.state.value.filter((t: string) => t !== id))
                }
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          );
        }}
      </form.Field>

      <form.Field
        name="recommendedTempoBpm"
        validators={{ onBlur: shape.recommendedTempoBpm }}
        listeners={clearTempoErrorWhenValid}
      >
        {(field) => <TempoField field={field} disabled={locked} />}
      </form.Field>

      <form.Field name="recommendedDurationSeconds">
        {(field) => <DurationField field={field} disabled={locked} />}
      </form.Field>

      <div className="flex gap-2">
        <Button type="submit" disabled={locked}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" disabled={locked} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

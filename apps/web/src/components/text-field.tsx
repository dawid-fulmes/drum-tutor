import type { AnyFieldApi } from "@tanstack/react-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TextFieldProps = {
  field: AnyFieldApi;
  label: string;
  type?: "text" | "email";
  autoComplete?: string;
  disabled?: boolean;
};

function errorMessage(error: unknown): string | undefined {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String(error.message);
  return undefined;
}

/** A TanStack Form field rendered with shadcn Label + Input, showing its first error. */
export function TextField({ field, label, type = "text", autoComplete, disabled }: TextFieldProps) {
  const error = field.state.meta.isTouched ? errorMessage(field.state.meta.errors[0]) : undefined;
  const errorId = `${field.name}-error`;

  return (
    <div className="grid gap-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        name={field.name}
        type={type}
        autoComplete={autoComplete}
        value={field.state.value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

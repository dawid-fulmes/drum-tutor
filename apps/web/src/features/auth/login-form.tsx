import { EmailSchema, type LoginRequest, LoginRequestSchema } from "@drum-tutor/contracts";
import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { useLoginMutation } from "./auth.api";

const defaultValues: LoginRequest = { email: "" };

export function LoginForm() {
  const login = useLoginMutation();
  const form = useForm({
    defaultValues,
    validators: { onSubmit: LoginRequestSchema },
    onSubmit: ({ value }) => login.mutate(value),
  });
  const pending = login.isPending;

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name="email" validators={{ onBlur: EmailSchema }}>
        {(field) => (
          <TextField
            field={field}
            label="Email"
            type="email"
            autoComplete="email"
            disabled={pending}
          />
        )}
      </form.Field>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Log in
      </Button>
    </form>
  );
}

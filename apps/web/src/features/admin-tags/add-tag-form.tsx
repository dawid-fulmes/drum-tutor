import { TagInputSchema, TagNameSchema } from "@drum-tutor/contracts";
import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { isTagNameTaken, useCreateTag } from "../tags/tags.api";

export function AddTagForm() {
  const createTag = useCreateTag();
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value, formApi }) => {
      try {
        await createTag.mutateAsync(TagInputSchema.parse(value));
        formApi.reset();
      } catch (error) {
        if (isTagNameTaken(error)) {
          formApi.setFieldMeta("name", (meta) => ({
            ...meta,
            isTouched: true,
            errorMap: { ...meta.errorMap, onSubmit: error.message },
          }));
        }
      }
    },
  });

  return (
    <form
      noValidate
      className="flex items-start gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            <div className="w-full max-w-sm">
              <form.Field name="name" validators={{ onSubmit: TagNameSchema }}>
                {(field) => <TextField field={field} label="Add tag" disabled={pending} />}
              </form.Field>
            </div>
            <Button type="submit" disabled={pending} className="mt-[22px]">
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Add tag
            </Button>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}

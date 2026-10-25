import { type AdminTag, TagNameSchema } from "@drum-tutor/contracts";
import { useForm } from "@tanstack/react-form";
import { Check, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isTagNameTaken, useDeleteTag, useRenameTag } from "../tags/tags.api";

function usedBy(count: number): string {
  if (count === 0) return "—";
  return count === 1 ? "1 lesson" : `${count} lessons`;
}

type RenameFormProps = { tag: AdminTag; onDone: () => void };

function RenameForm({ tag, onDone }: RenameFormProps) {
  const rename = useRenameTag();
  const form = useForm({
    defaultValues: { name: tag.name },
    onSubmit: async ({ value, formApi }) => {
      const parsed = TagNameSchema.safeParse(value.name);
      if (!parsed.success) return;
      if (parsed.data === tag.name) {
        onDone();
        return;
      }
      try {
        await rename.mutateAsync({ id: tag.id, name: parsed.data });
        onDone();
      } catch (error) {
        if (isTagNameTaken(error)) {
          formApi.setFieldMeta("name", (meta) => ({
            ...meta,
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
            <form.Field name="name" validators={{ onSubmit: TagNameSchema }}>
              {(field) => {
                const error = field.state.meta.errors[0];
                const message =
                  typeof error === "string"
                    ? error
                    : error && typeof error === "object" && "message" in error
                      ? String(error.message)
                      : undefined;
                return (
                  <div className="grid w-full max-w-xs gap-1">
                    <Input
                      autoFocus
                      aria-label={`Name of ${tag.name}`}
                      value={field.state.value}
                      disabled={pending}
                      aria-invalid={message ? true : undefined}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          onDone();
                        }
                      }}
                    />
                    {message ? <p className="text-sm text-destructive">{message}</p> : null}
                  </div>
                );
              }}
            </form.Field>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
              Save
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onDone}>
              <X aria-hidden />
              Cancel
            </Button>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}

function DeleteButton({ tag }: { tag: AdminTag }) {
  const remove = useDeleteTag();
  const [open, setOpen] = useState(false);

  if (tag.lessonCount > 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A disabled button swallows pointer events, so the span receives hover and focus. */}
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: focusable wrapper so the tooltip opens by keyboard */}
          <span tabIndex={0}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled
              aria-label={`Delete ${tag.name}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Used by lessons</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${tag.name}`}>
          <Trash2 aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete tag?</AlertDialogTitle>
          <AlertDialogDescription>{`"${tag.name}" will be deleted.`}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={remove.isPending}
            onClick={(event) => {
              event.preventDefault();
              remove.mutate(tag.id, {
                onSuccess: () => setOpen(false),
                onError: () => setOpen(false),
              });
            }}
          >
            {remove.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function TagRow({ tag }: { tag: AdminTag }) {
  const [editing, setEditing] = useState(false);

  return (
    <TableRow>
      <TableCell>
        {editing ? (
          <RenameForm tag={tag} onDone={() => setEditing(false)} />
        ) : (
          <span className="font-medium">{tag.name}</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{usedBy(tag.lessonCount)}</TableCell>
      <TableCell className="text-right">
        {editing ? null : (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Rename ${tag.name}`}
              onClick={() => setEditing(true)}
            >
              <Pencil aria-hidden />
            </Button>
            <DeleteButton tag={tag} />
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

import type { AdminLessonSummary } from "@drum-tutor/contracts";
import { Link } from "@tanstack/react-router";
import { Ellipsis, Loader2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeleteLesson, usePublishLesson, useUnpublishLesson } from "./admin-lessons.api";

export function LessonRowActions({ lesson }: { lesson: AdminLessonSummary }) {
  const publish = usePublishLesson();
  const unpublish = useUnpublishLesson();
  const remove = useDeleteLesson();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pending = publish.isPending || unpublish.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={pending}
            aria-label={`Actions for ${lesson.name}`}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Ellipsis aria-hidden />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {lesson.locked ? (
            <DropdownMenuItem disabled>Edit</DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <Link to="/admin/lessons/$lessonId/edit" params={{ lessonId: lesson.id }}>
                Edit
              </Link>
            </DropdownMenuItem>
          )}
          {lesson.status === "draft" ? (
            <DropdownMenuItem onSelect={() => publish.mutate(lesson.id)}>Publish</DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={lesson.locked} onSelect={() => unpublish.mutate(lesson.id)}>
              Move to draft
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={lesson.locked}
            onSelect={() => setConfirmOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${lesson.name}" will be deleted. This can't be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                remove.mutate(lesson.id, {
                  onSuccess: () => setConfirmOpen(false),
                  onError: () => setConfirmOpen(false),
                });
              }}
            >
              {remove.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

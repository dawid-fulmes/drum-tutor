import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { z } from "zod";
import { NotFound } from "@/components/not-found";
import { QueryError } from "@/components/query-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminLessonQueryOptions,
  useUpdateLesson,
} from "@/features/admin-lessons/admin-lessons.api";
import { LessonForm } from "@/features/admin-lessons/lesson-form";
import { ApiClientError } from "@/lib/api-client";

export const Route = createFileRoute("/_authenticated/admin/lessons/$lessonId/edit")({
  component: EditLessonPage,
});

const lessonNotFound = (
  <NotFound title="Lesson not found" backTo="/admin/lessons" backLabel="Back to lessons" />
);

function EditLessonPage() {
  const { lessonId } = Route.useParams();
  // The API answers 400 for a malformed id; skip the request and show "not found" right away.
  if (!z.uuid().safeParse(lessonId).success) return lessonNotFound;
  return <EditLesson id={lessonId} />;
}

function EditLesson({ id }: { id: string }) {
  const navigate = useNavigate();
  // gcTime 0: the form is initialised from the loaded lesson, so never from a stale cached copy.
  const lesson = useQuery({ ...adminLessonQueryOptions(id), gcTime: 0 });
  const update = useUpdateLesson(id);

  if (
    lesson.error instanceof ApiClientError &&
    (lesson.error.status === 400 || lesson.error.status === 404)
  ) {
    return lessonNotFound;
  }
  if (lesson.isError && !lesson.data) {
    return <QueryError error={lesson.error} onRetry={() => lesson.refetch()} />;
  }
  if (!lesson.data) {
    return (
      <div className="grid max-w-2xl gap-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-9 w-2/3" />
      </div>
    );
  }

  const { data } = lesson;

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">Edit lesson</h1>
      {data.locked ? (
        <Alert>
          <Lock aria-hidden />
          <AlertTitle>This lesson is locked</AlertTitle>
          <AlertDescription>
            Someone has already practiced it, so it can't be edited or deleted.
          </AlertDescription>
        </Alert>
      ) : null}
      <LessonForm
        key={String(data.locked)}
        defaultValues={{
          name: data.name,
          description: data.description,
          difficulty: data.difficulty,
          tagIds: data.tags.map((tag) => tag.id),
          recommendedTempoBpm: data.recommendedTempoBpm,
          recommendedDurationSeconds: data.recommendedDurationSeconds,
        }}
        disabled={data.locked}
        pending={update.isPending}
        submitLabel="Save"
        onSubmit={(input) =>
          update.mutate(input, {
            onSuccess: () => navigate({ to: "/admin/lessons" }),
            onError: (error) => {
              // Locked or deleted in the meantime (the global toast shows the message): reload so
              // the page switches to the locked Alert or "Lesson not found".
              if (
                error instanceof ApiClientError &&
                (error.status === 409 || error.status === 404)
              ) {
                void lesson.refetch();
              }
            },
          })
        }
        onCancel={() => navigate({ to: "/admin/lessons" })}
      />
    </div>
  );
}

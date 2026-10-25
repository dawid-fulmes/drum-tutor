import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCreateLesson } from "@/features/admin-lessons/admin-lessons.api";
import { LessonForm, NEW_LESSON_DEFAULTS } from "@/features/admin-lessons/lesson-form";

export const Route = createFileRoute("/_authenticated/admin/lessons/new")({
  component: NewLessonPage,
});

function NewLessonPage() {
  const navigate = useNavigate();
  const create = useCreateLesson();

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">New lesson</h1>
      <LessonForm
        defaultValues={NEW_LESSON_DEFAULTS}
        pending={create.isPending}
        submitLabel="Create lesson"
        onSubmit={(input) =>
          create.mutate(input, { onSuccess: () => navigate({ to: "/admin/lessons" }) })
        }
        onCancel={() => navigate({ to: "/admin/lessons" })}
      />
    </div>
  );
}

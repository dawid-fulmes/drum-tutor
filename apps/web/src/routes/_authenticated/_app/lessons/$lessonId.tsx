import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/lessons/$lessonId")({
  component: LessonDetailsPlaceholder,
});

// Placeholder: replaced by the lesson details screen in Task 3.
function LessonDetailsPlaceholder() {
  return <h1 className="text-2xl font-semibold">Lesson</h1>;
}

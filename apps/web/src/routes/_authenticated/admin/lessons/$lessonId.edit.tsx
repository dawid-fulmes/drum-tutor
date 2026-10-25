import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/lessons/$lessonId/edit")({
  component: () => <h1 className="text-xl font-semibold">Edit lesson</h1>,
});

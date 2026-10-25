import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/lessons/")({
  component: () => <h1 className="text-xl font-semibold">Lessons</h1>,
});

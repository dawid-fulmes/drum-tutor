import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/lessons/new")({
  component: () => <h1 className="text-xl font-semibold">New lesson</h1>,
});

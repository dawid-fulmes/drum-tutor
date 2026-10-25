import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/tags")({
  component: () => <h1 className="text-xl font-semibold">Tags</h1>,
});

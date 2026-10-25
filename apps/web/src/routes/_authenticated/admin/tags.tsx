import { createFileRoute } from "@tanstack/react-router";
import { AdminTagsPage } from "@/features/admin-tags/admin-tags-page";

export const Route = createFileRoute("/_authenticated/admin/tags")({
  component: AdminTagsPage,
});

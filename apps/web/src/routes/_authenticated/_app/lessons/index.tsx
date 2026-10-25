import { createFileRoute } from "@tanstack/react-router";
import { LibraryPage } from "@/features/lessons/library-page";
import { librarySearchSchema } from "@/features/lessons/library-search";

export const Route = createFileRoute("/_authenticated/_app/lessons/")({
  validateSearch: librarySearchSchema,
  component: LibraryPage,
});

import { createFileRoute } from "@tanstack/react-router";
import { librarySearchSchema } from "@/features/lessons/library-search";

export const Route = createFileRoute("/_authenticated/_app/lessons/")({
  validateSearch: librarySearchSchema,
  component: LibraryPage,
});

function LibraryPage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Library</h1>
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_app/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main className="mx-auto max-w-5xl p-6">
      <p>Library coming soon.</p>
    </main>
  );
}
